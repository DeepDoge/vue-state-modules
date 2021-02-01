import { VueConstructor, WatchOptions } from 'vue/types/umd'
import { CombinedVueInstance, CreateElement } from 'vue/types/vue'

type VM = CombinedVueInstance<Vue, object, object, object, Record<any, any>>

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

export class Module
{
    started(): void { }
    $commit(): number { return 0 }
    $revert(commitIndex: number) { }
    $watch<T>(expOrFn: (this: VM) => T, callback: (this: VM, n: T, o: T) => void, options?: WatchOptions | undefined): void { }
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

const defineModule = <T extends Module>(moduleName: string, classObject: T) =>
{
    if (!(classObject instanceof Module)) throw new Error(`module expected to extend ${Module.name}`)
    const object = Object.assign(Object.getPrototypeOf(classObject), classObject) as T
    const descriptors = Object.getOwnPropertyDescriptors(object)

    const states: { [key: string]: any } = {}
    const getters: { [key: string]: <T>() => T } = {}
    const classInterface: any = {}

    const toSafeName = (name: string) => `${name}_`

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

    Object.defineProperty(classInterface, '$watch', {
        value: (...parameters: any[]) => (vm.$watch as any)(...parameters),
        writable: false
    })

    const commits: { [key: string]: any }[] = []
    Object.defineProperty(classInterface, '$commit', {
        value: () => 
        {
            commits.push(Object.fromEntries(Object.keys(states).map((stateName) => [stateName, vm[stateName]])))
            return commits.length - 1
        },
        writable: false
    })
    Object.defineProperty(classInterface, '$revert', {
        value: (commitIndex: number) => 
        {
            const commit = commits[commitIndex]
            if (!commit) throw new Error(`commit index "${commitIndex}" doesnt exist.`)
            for (const [stateName, state] of Object.entries(commit))
                vm[stateName] = state
        },
        writable: false
    })

    return { vm, classInterface: classInterface as T }
}

export const VueSM = { Modules, install }