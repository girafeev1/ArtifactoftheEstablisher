export type ProjectsSortMethod = 'year' | 'subsidiary'

export interface SelectionDescriptor {
  type: ProjectsSortMethod
  year: string
}
