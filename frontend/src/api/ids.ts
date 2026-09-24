/** Convert route/string ids to numeric API ids. */
export function toId(id: string | number): number {
  return typeof id === 'number' ? id : Number(id)
}
