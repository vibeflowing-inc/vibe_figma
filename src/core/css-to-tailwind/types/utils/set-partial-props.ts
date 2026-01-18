export type SetPartialProps<Type, Props extends keyof Type> = Partial<
  Pick<Type, Props>
> &
  Omit<Type, Props>;
