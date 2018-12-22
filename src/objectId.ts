const objIdMap: WeakMap<object, number> = new WeakMap()
let objectCount: number = 0

export default function objectId(o: object): number {
  if (!objIdMap.has(o)) objIdMap.set(o,++objectCount)

  return <number>objIdMap.get(o)
}
