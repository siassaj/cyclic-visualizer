import { color as csxColor } from 'csx'

import * as colors from './colors.json'

export type Color = keyof typeof colors

export function color(name: Color) {
  return csxColor(colors[name]).toHexString()
}

export function lighten(name: Color, amount: number) {
  return csxColor(colors[name]).lighten(amount).toHexString()
}

export function darken(name: Color, amount: number) {
  return csxColor(colors[name]).darken(amount).toHexString()
}

export function saturate(name: Color, amount: number) {
  return csxColor(colors[name]).saturate(amount).toHexString()
}
