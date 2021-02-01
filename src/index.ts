import { VueConstructor, WatchOptions } from 'vue/types/umd'
import { CombinedVueInstance, CreateElement } from 'vue/types/vue'

type VM = CombinedVueInstance<Vue, object, object, object, Record<any, any>>
export type ModuleSample = { [sampleName: string]: any }
type WatchGetter<T> = () => T
type WaitForOptions = { deep?: boolean }

export class Module
{
    started(): void { }
    $sample(): ModuleSample { return {} }
    $revert(sample: ModuleSample): void { }
    $on(event: string | string[], callback: Function): { off(): void } { return { off() { } } }
    $off(event?: string | string[] | undefined, callback?: Function | undefined): void { }
    $emit(event: string, ...args: any[]): void { }
    $waitFor<T>(getter: WatchGetter<T>, condition: (newValue: T, oldValue: T) => boolean | undefined, options?: WaitForOptions): Promise<T> { return new Promise<T>(() => { }) }
    $watch<T>(getter: WatchGetter<T>, callback: (newValue: T, oldValue: T) => void, options?: WatchOptions): () => void { return () => { } }
}

let Vue: VueConstructor
let devToolRoot: VM

const install = (vue: VueConstructor) =>
{
    Vue = vue

    devToolRoot = new Vue({
        name: "VueStateModules",
        render: (createElement: CreateElement) => createElement('noscript')
    })
    const el = document.createElement('noscript')
    document.body.insertBefore(el, document.body.childNodes[0])
    devToolRoot.$mount(el)
}

const Modules = <T>(modules: T) =>
{
    const vms: VM[] = []
    const classInterfaces: { [key: string]: any } = {}

    for (const [moduleName, module] of Object.entries(modules))
    {
        const defined = defineModule(moduleName, module)
        vms.push(defined.vm)
        classInterfaces[moduleName] = defined.classInterface
    }

    if (devToolRoot)
    {
        for (const vm of vms)
        {
            devToolRoot.$children.push(vm)
        }
    }

    for (const [moduleName, classInterface] of Object.entries(classInterfaces))
    {
        classInterface['started']()
    }

    return Vue.prototype.$modules = { ...classInterfaces as T }
}

const defineModule = <T extends Module>(moduleName: string, classInstance: T) =>
{
    if (!(classInstance instanceof Module)) throw new Error(`module expected to extend ${Module.name}`)
    const object = Object.assign(Object.getPrototypeOf(classInstance), classInstance) as T
    const descriptors = Object.getOwnPropertyDescriptors(object)

    const states: { [key: string]: any } = {}
    const getters: { [key: string]: <T>() => T } = {}
    const classInterface: any = {}

    const toSafeName = (name: string) => `[${name}]`

    for (const [descriptorName, descriptor] of Object.entries(descriptors))
    {
        const safeName = toSafeName(descriptorName)
        if (descriptor.get)
        {
            getters[safeName] = () => classInterface[descriptorName]
            Object.defineProperty(classInterface, descriptorName, {
                get: descriptor.get
            })
        }
        else if (descriptor.set)
        {
            Object.defineProperty(classInterface, descriptorName, {
                set: descriptor.set
            })
        }
        else switch (typeof descriptor.value)
        {
            case 'function':
                Object.defineProperty(classInterface, descriptorName, {
                    value: descriptor.value,
                    writable: false
                })
                break

            default:
                states[safeName] = descriptor.value
                Object.defineProperty(classInterface, descriptorName, {
                    get() { return vm[safeName] },
                    set(value) { return vm[safeName] = value }
                })
                break
        }
    }

    const vm = new Vue({
        name: moduleName,
        computed: getters,
        data: () => states
    })

    // Functions From VueComponent
    Object.defineProperty(classInterface, '$watch', {
        value: (...parameters: any[]) => (vm.$watch as any)(...parameters),
        writable: false
    })

    Object.defineProperty(classInterface, '$on', {
        value: (...parameters: any[]) => 
        {
            (vm.$on as any)(...parameters)
            const off = () => { vm.$off(...parameters) }
            return { off }
        },
        writable: false
    })
    Object.defineProperty(classInterface, '$off', {
        value: (...parameters: any[]) => { (vm.$off as any)(...parameters) },
        writable: false
    })
    Object.defineProperty(classInterface, '$emit', {
        value: (...parameters: any[]) => { (vm.$emit as any)(...parameters) },
        writable: false
    })

    // New Functions
    Object.defineProperty(classInterface, '$waitFor', {
        value: <T>(getter: WatchGetter<T>, condition: (newValue: T, oldValue: T) => boolean | undefined, options?: WaitForOptions) => new Promise((resolve, reject) =>
        {
            const unwatch = vm.$watch(getter, (newValue: T, oldValue: T) =>
            {
                if (!condition(newValue, oldValue)) return
                unwatch()
                resolve(newValue)
            }, options)
        }),
        writable: false
    })

    Object.defineProperty(classInterface, '$sample', {
        value: () => 
        {
            return Object.fromEntries(Object.keys(states).map((stateName) => [stateName, vm[stateName]]))
        },
        writable: false
    })
    Object.defineProperty(classInterface, '$revert', {
        value: (sample: ModuleSample) => 
        {
            if (typeof sample !== 'object') throw new Error('sample type is not valid.')
            for (const stateName of Object.keys(states))
            {
                vm[stateName] = sample[stateName]
            }
        },
        writable: false
    })

    return { vm, classInterface: classInterface as T }
}

export const VueSM = { Modules, install }