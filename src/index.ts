import { VueConstructor } from 'vue/types/umd'
import { CombinedVueInstance } from 'vue/types/vue'

let Vue: VueConstructor

const install = (vue: VueConstructor) =>
{
    Vue = vue
}

export class Module
{
    started(): void { }
}

const Modules = <T>(modules: T) => {
    const vm = new Vue()
    const $watch = vm.$watch

    const extra = { $watch }

    for (const [moduleName, module] of Object.entries(modules))
        module.__states__ = Vue.observable(module.__states__)
    for (const [moduleName, module] of Object.entries(modules))
        module.started()

    return Vue.prototype.$modules = { ...modules, ...extra }
}

const defineModule = <T extends Module>(classObject: T) =>
{
    if (!(classObject instanceof Module)) throw new Error(`module expected to be a ${Module.name}`)
    const object = Object.assign(Object.getPrototypeOf(classObject), classObject) as T
    const descriptors = Object.getOwnPropertyDescriptors(object)

    const states: { [key: string]: any } = {}
    const classInterface: { [key: string]: any } = {}

    for (const [descriptorName, descriptor] of Object.entries(descriptors))
    {
        if (descriptor.get)
        {
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
                classInterface[descriptorName] = descriptor.value
                break

            default:
                states[descriptorName] = descriptor.value
                Object.defineProperty(classInterface, descriptorName, {
                    get() { return classInterface.__states__[descriptorName] },
                    set(value) { return classInterface.__states__[descriptorName] = value }
                })
                break
        }
    }

    classInterface.__states__ = states

    return classInterface as T
}

export const VueSM = { Modules, install, defineModule }