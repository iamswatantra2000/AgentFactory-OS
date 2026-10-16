export function canUseTestCheckout(environment: string | undefined, enabled: string | undefined) {
  return (environment === 'development' || environment === 'test') && enabled === 'true';
}
