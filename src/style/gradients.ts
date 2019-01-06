type HexString = string
type Degrees   = number

export function gradient2(
  color1: HexString,
  color2: HexString,
  angle: Degrees): Array<string> {

  return [
    color2,
    `-moz-linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`,
    `-webkit-linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`,
    `linear-gradient(${180 + angle}deg, ${color1} 0%, ${color2} 100%)`,
  ]
}

export function gradient3(
  color1: HexString,
  color2: HexString,
  color3: HexString,
  angle: Degrees): Array<string> {

  return [
    color2,
    `-moz-linear-gradient(${angle}deg, ${color1} 33%, ${color2} 66%, ${color3} 100%)`,
    `-webkit-linear-gradient(${angle}deg, ${color1} 33%, ${color2} 66%, ${color3} 100%)`,
    `linear-gradient(${180 + angle}deg, ${color1} 33%, ${color2} 66%, ${color3} 100%)`,
  ]
}
