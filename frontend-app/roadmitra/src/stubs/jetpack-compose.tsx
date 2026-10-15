import React from 'react';
import { View, Text as RNText } from 'react-native';

const StubComponent: any = React.forwardRef<any, any>((props, ref) => {
  return <View ref={ref} {...props}>{props.children}</View>;
});

StubComponent.Trigger = StubComponent;
StubComponent.Items = StubComponent;
StubComponent.LeadingIcon = StubComponent;
StubComponent.TrailingIcon = StubComponent;
StubComponent.Text = StubComponent;

export const Host = StubComponent;
export const Row = StubComponent;
export const Box = StubComponent;
export const Badge = StubComponent;
export const Text = RNText;
export const IconButton = StubComponent;
export const Icon = StubComponent;
export const DropdownMenu = StubComponent;
export const DropdownMenuItem = StubComponent;
export const HorizontalDivider = StubComponent;
export const RNHostView = StubComponent;
export const HorizontalFloatingToolbar = StubComponent;

const proxy = new Proxy(StubComponent, {
  get(target, prop) {
    if (prop in target) {
      return (target as any)[prop];
    }
    return StubComponent;
  },
});

export default proxy;
