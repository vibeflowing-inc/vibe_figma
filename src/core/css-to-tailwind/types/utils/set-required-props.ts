export type SetRequiredProps<Type, Props extends keyof Type> = Required<
  Pick<Type, Props>
> &
  Type;
