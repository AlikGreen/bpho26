export function assert(
    condition: boolean,
    msg?: string | (() => string)
  ): asserts condition 
  {
    if (!condition) 
    {
      throw new Error(msg && (typeof msg === 'string' ? msg : msg()));
    }
  }


export function assertOK<T>(value: Error | T): T 
{
    if (value instanceof Error) 
    {
        throw value;
    }
    return value;
}


export function unreachable(msg?: string): never 
{
    throw new Error(msg);
}
  