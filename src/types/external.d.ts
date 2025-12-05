import type { ComponentType } from 'react';

declare module 'prop-types' {
  const content: Record<string, unknown>;
  export default content;
}

type AccountComponent = ComponentType<Record<string, unknown>>;

declare module '../components/account/AccountHero' {
  const Component: AccountComponent;
  export default Component;
}

declare module '../components/account/ProfileCard' {
  const Component: AccountComponent;
  export default Component;
}

declare module '../components/account/EmailCard' {
  const Component: AccountComponent;
  export default Component;
}

declare module '../components/account/PasswordCard' {
  const Component: AccountComponent;
  export default Component;
}

declare module '../components/account/SessionsCard' {
  const Component: AccountComponent;
  export default Component;
}

declare module '../components/account/MfaCard' {
  const Component: AccountComponent;
  export default Component;
}

declare module '../components/account/PasskeysCard' {
  const Component: AccountComponent;
  export default Component;
}

declare module '../components/account/OauthCard' {
  const Component: AccountComponent;
  export default Component;
}
