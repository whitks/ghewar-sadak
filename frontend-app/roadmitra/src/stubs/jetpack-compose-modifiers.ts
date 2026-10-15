const dummyModifier = (..._args: any[]) => ({});

const handler: ProxyHandler<any> = {
  get(_target, _prop) {
    return dummyModifier;
  },
};

const modifiers = new Proxy({}, handler);

export const alpha = dummyModifier;
export const background = dummyModifier;
export const fillMaxHeight = dummyModifier;
export const fillMaxWidth = dummyModifier;
export const padding = dummyModifier;
export const imePadding = dummyModifier;
export const height = dummyModifier;
export const width = dummyModifier;

export default modifiers;
