export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type AsyncNullable<T> = Promise<Nullable<T>>;

export type AsyncOptional<T> = Promise<Optional<T>>;
