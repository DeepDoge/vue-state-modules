# vue-state-modules
- class based `state store` fully made in `typescript` for vue.
- you can just use it like a normal class instance and it just makes your variables(states) `reactive` automatically.
- it has functions like (`$watch`, `$on`, `$off`, `$emit`, `$sample` and `$revert`...) too.
- and you can `inspect` your `state modules` in `vue devtool`.

# installation
- first install the node_module from npm
```bash 
npm i @dumshiba/vue-state-modules
```
- then create a file to register the plugin to vue__
*file: src/modules/index.ts*
```ts
import Vue from 'vue'
import { VueSM } from '@dumshiba/vue-state-modules'

import testModule from './testModule'

// installing the vue-state-modules plugin for Vue
Vue.use(VueSM)

export const modules = VueSM.Modules({ 
    // your modules here
    testModule: new testModule() 
})

// making your modules visible for typescript 
declare module 'vue/types/vue'
{
    interface Vue
    {
        $modules: typeof modules
    }
}
```
- and create a file for your module\
*file: src/modules/testModule.ts*
```ts
import { Module } from '@dumshiba/vue-state-modules'

export default class testModule extends Module
{
    // runs when the module is ready
    started()
    {
        
    }
}
```
*i might make a vue-cli-plugin for the things above later*
## usage
*file: src/modules/testModule.ts*
```ts
import { Module } from '@dumshiba/vue-state-modules'

export default class testModule extends Module
{
    // states
    someState = 0
    half = 0

    // runs when the module is ready
    started()
    {
        // watcher for 'someState'
        this.$watch(() => this.someState, (newValue, oldValue) => this.half = newValue / 2)

        setInterval(() => this.incrementSomeState(), 1000)
    }

    // computed, getter
    get double()
    {
        return this.someState * 2   
    }

    // methods
    incrementSomeState()
    {
        this.someState++
    }
}
```
- then you can use it like thise\
*file: src/components/someVueComponent.vue*
```vue
<template>
    <div>
        <div>someState: {{$modules.testModule.someState}}</div>
        <div>half: {{$modules.testModule.half}}</div>
        <div>double: {{$modules.testModule.double}}</div>
    </div>
</template>
```

## module methods
you also have some methods that you can access from outside or inside of the module
### $watch
watches for changes on `states` or `getters` *(from vue)*
```ts
import { Module } from '@dumshiba/vue-state-modules'

export default class testModule extends Module
{
    someState = 0

    // runs when the module is ready
    started()
    {
        // watches changes for 'someValue' and when it changes console.logs the values
        const unwatch = this.$watch(() => this.someState, (newValue, oldValue) => console.log(`someState changed oldValue:${oldValue} newValue:${newValue}`))
        // unwatch()
    }
}
```
### $on, $off, $emit
custom event system *(from vue)*
```ts
import { Module } from '@dumshiba/vue-state-modules'

export default class testModule extends Module
{
    // runs when the module is ready
    started()
    {
        // add listener for 'incremented'
        const listener = this.$on('incremented', this.onIncrement) 
        
        // there are two ways to remove the listener
        // 1.
        // this.$off('incremented', onIncrement)
        // 2.
        // listener.off()
    }

    onIncrement()
    {
        console.log(`someState incremented`)
    }

    someState = 0
    incrementSomeState()
    {
        this.someState++

        // invoke the listeners
        this.$emit('incremented')
    }
}
```
### $waitFor
combination of `watch` and `promise`. let's you wait until a state matches with your conditions in async functions
```ts
import { Module } from '@dumshiba/vue-state-modules'

export default class testModule extends Module
{
    someState = 0

    // runs when the module is ready
    async started()
    {
        // start the incremention loop
        this.loop()

        // wait until someState is 5
        await this.$waitFor(() => this.someState, (newValue, oldValue) => newValue === 5) 

        console.log('someState reached 5')
    }

    async loop()
    {
        while (this.someState < 10)
        {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            this.someState++
        }
    }
}
```

### $sample, $revert
let's you take a sample of the current states from a module and then you can revert back the module to that state automatically
```ts
import { Module, ModuleSample } from '@dumshiba/vue-state-modules'

export default class testAuthModule extends Module
{
    token?: string = undefined
    user?: { name: string, uid: string } = undefined

    private cleanState!: ModuleSample  
    started()
    {
        // takes a sample of the current state of module
        this.cleanState = this.$sample()
    }

    logout()
    {
        // reverts back to clean state of the module
        // (basically sets all of the states based on the sample 'cleanState')
        this.$revert(this.cleanState)
    }

    login(username: string, password: string)
    {
        // ...some login method
        this.user =  { name: 'shiba', uid: '1a2b3c4d' }
        this.token = 'a1b2c3d4...'
    }
}
```