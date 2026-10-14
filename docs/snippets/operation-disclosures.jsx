export const OperationDisclosures = ({ operation }) => {
  const tiles = [
    { key: 'sender', label: 'Sender' },
    { key: 'recipient', label: 'Recipient' },
    { key: 'asset', label: 'Asset' },
    { key: 'amount', label: 'Amount' },
  ];

  const disclosureByOperation = {
    deposit: {
      sender: 'public',
      recipient: 'private',
      asset: 'public',
      amount: 'public',
    },
    withdraw: {
      sender: 'both',
      recipient: 'public',
      asset: 'public',
      amount: 'public',
    },
    'public-withdraw': {
      sender: 'public',
      recipient: 'public',
      asset: 'public',
      amount: 'public',
    },
    'transfer-registered': {
      sender: 'both',
      recipient: 'private',
      asset: 'private',
      amount: 'private',
    },
    'transfer-unregistered': {
      sender: 'both',
      recipient: 'private',
      asset: 'private',
      amount: 'private',
    },
  };

  const valueHints = {
    public: 'Must be public',
    private: 'Must be private',
    both: 'Public or private',
  };

  const senderBothHint = 'Sender can remain private with Protocol Relay';

  const valueStyles = {
    public: 'bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#93C5FD]',
    private: 'bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    both: 'bg-zinc-500/10 text-zinc-700 dark:bg-zinc-400/10 dark:text-zinc-300',
  };

  const values = disclosureByOperation[operation];
  if (!values) {
    return null;
  }

  return (
    <div className="not-prose my-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => {
        const supportedDisclosure = values[tile.key];
        const fieldValue = supportedDisclosure === 'both' ? 'private' : supportedDisclosure;
        const hint =
          tile.key === 'sender' && supportedDisclosure === 'both'
            ? senderBothHint
            : valueHints[fieldValue];

        return (
          <div
            key={tile.key}
            className="flex flex-col gap-3 rounded-lg bg-zinc-50 px-4 py-3.5 dark:bg-white/[0.03]"
          >
            <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{tile.label}</div>
            <div className="group relative w-fit">
              <div
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium ${valueStyles[fieldValue]}`}
                title={hint}
              >
                {fieldValue === 'public' ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    <path d="M2 12h20" />
                  </svg>
                ) : fieldValue === 'private' ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="m16 3 4 4-4 4" />
                    <path d="M20 7H4" />
                    <path d="m8 21-4-4 4-4" />
                    <path d="M4 17h16" />
                  </svg>
                )}
                <span>{fieldValue === 'private' ? 'Private' : 'Public'}</span>
              </div>
              <div
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-max max-w-[14rem] rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs leading-snug text-white opacity-0 shadow-md transition-opacity duration-150 invisible group-hover:visible group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900"
                role="tooltip"
              >
                {hint}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
