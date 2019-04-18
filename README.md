
For CycleJS applications


## Testing
Testing should come first, even though I'm an ass that didn't do much of it.
We're using jest


## Installation & Usage
It's early day for the project, so you'll have to clone & build it


### Clone & Build
```
$ git clone git@github.com:siassaj/cyclic-visualizer.git
$ cd cyclic-visualizer
$ yarn install
$ npm run build
```


### Add to chrome
1. navigate to chrome://extensions
1. turn on Developer mode
1. click Load unpacked
1. open to cyclic-visualizer/dist/chromeExtension


### Tool your components with visualize function
1. copy dist/visualize.js or src/visualize.ts to your app's source dir
1. ```import visualize, { setSources } from 'path/to/visualize'```
1. use ```setSources(sources)``` ONCE within root level main function
1. use ```visualize(sinks, { scope: '<name of component>', prefix: '<some prefix tag that is useful to you>' })```

visualize will be added to npm at some point, but copy it over for now.

```typescript
// BASIC EXAMPLE
//
function main(sources) {
  const navigation  = isolate(Navigation, 'nav')(sources)
  const ctaForm     = isolate(CTAForm,    'ctaForm')(sources)

  visualize(navigation, { scope: 'nav' })
  visualize(navigation, { scope: 'ctaForm' })

  // ... rest of function
}

// EXAMPLE USING PREFIX
//
// Here we use the 'prefix' attribute of visualize with Component and Operation
// Component means a cyclejs component that sinks to DOM
// Operation means a cyclejs component that does _not_ sink to DOM,
//   used to isolate discrete stream based operations such as sinking to
//   a parallax driver on an animation driver.

// Convenience function for mounting & visualizing Components
function mountComponent(component, scope, sources) {
  const sinks = isolate(component, scope)(sources)
  visualize(sinks, { scope: scope, prefix: "Component" })
  return sinks
}

// Convenience function for mounting & visualizing Operations
function mountOperation(operation, scope, sources) {
  const sinks = component(sources)
  visualize(sinks, { scope: scope, prefix: "Operation" })
  return sinks
}

function main(sources) {
  const navigation  = mountComponent(Navigation, 'nav',     sources)
  const ctaForm     = mountComponent(CTAForm,    'ctaForm', sources)

  const parallaxBG  = mountOperation(ParallaxBackground,  'parallaxBG',  sources)
  const animateLogo = mountOperation(AnimateLogo, 'animateLogo', sources)

  // ... rest of function
}
```


### Watch these videos for an extremely basic view of how to use this

[Cyclic Visualizer WIP Playlist](https://www.youtube.com/playlist?list=PLQL3wlBb5AvQpX8kP1pOgPZr4alADVAHK)

Then make some better videos!


## Project Structure
Important directories
```
assets/ (assets such as HTML files & manifests)
src/
  chromeExtension/ (scripts used by chrome to set up the devtool)
  devtoolApp/ (CycleJS app running in the devtool cyclic visualizer panel)
  pageApp/ (CycleJS app running in the inspected page, extracting data for the visualizer)
  cycleGraph/ (represents your cyclejs app, stores node & edge info, has diff/patch functionality, etc.)
```


### Notes
Chrome communication & script injection in chrome is a pain. This is how it works.
1. Chrome extension is added, ```background``` script is turned on & waits for connections
1. You Open inspector & click Cyclic Visualizer panel
1. ```devtool``` script runs & connects to background, sending 'incjectContentScript' instruction
1. ```contentScript``` is injected into your page & injects ```pageScript```
1. ```pageScript``` has access to your app's ```window```, tries to search for a cycle app
1. If a cycle app is found a message is posted on ```window```, ```contentScript``` picks up the message & posts it to ```background```, ```background``` posts it to ```devtool```, ```devtool``` posts it to ```panel``` window. FINALLY the devtool CycleJS app's driver gets the message.

This is how messages are transmitted. Have fun.
