type MarketStatusProps = {
  message: string;
  error?: boolean;
};

export function MarketStatus({ message, error = false }: MarketStatusProps) {
  return (
    <p role={error ? 'alert' : 'status'} aria-live="polite">
      {message}
    </p>
  );
}
