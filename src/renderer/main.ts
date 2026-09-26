import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import BallToy from './toys/BallToy.svelte'

const target = document.getElementById('app')
if (!target) throw new Error('Missing #app element')

// The same UI bundle serves the pet window and the ball's little window.
export default mount(location.hash === '#ball' ? BallToy : App, { target })
