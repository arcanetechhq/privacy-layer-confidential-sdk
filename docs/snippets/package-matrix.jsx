export const PackageMatrix = () => {
  const rows = [
    {
      name: '@arcanetech/privacy-sdk-core',
      role: 'Intents, lifecycle, errors, events, adapter contracts, authorization envelope',
      browser: true,
      node: true,
      tests: true,
    },
    {
      name: '@arcanetech/privacy-sdk-data-layer',
      role: 'Private-record HTTP client checked with the schemas you pass',
      browser: true,
      node: true,
      tests: true,
    },
    {
      name: '@arcanetech/privacy-sdk-relay',
      role: 'Protocol relay runtime over caller-supplied ports',
      browser: true,
      node: true,
      tests: true,
    },
    {
      name: '@arcanetech/privacy-sdk-stellar',
      role: 'Stellar client, transact engine, state integration, bundled runtime assets',
      browser: true,
      node: true,
      tests: true,
      note: '/node and /testing subpaths',
    },
    {
      name: '@arcanetech/privacy-sdk-state-memory',
      role: 'In-memory state adapter',
      browser: true,
      node: true,
      tests: true,
    },
    {
      name: '@arcanetech/privacy-sdk-state-redux',
      role: 'Redux Toolkit adapter and persistence helpers',
      browser: true,
      node: false,
      tests: true,
      note: 'React apps',
    },
  ];

  const Check = () => (
    <span className="text-emerald-600 dark:text-emerald-400" aria-hidden="true">
      ✓
    </span>
  );

  const Dash = () => (
    <span className="text-zinc-400 dark:text-zinc-500" aria-hidden="true">
      —
    </span>
  );

  return (
    <div className="not-prose my-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-zinc-50 dark:bg-white/[0.03]">
          <tr>
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
              Package
            </th>
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
              Role
            </th>
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
              Browser
            </th>
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
              Node
            </th>
            <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
              Tests
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="px-4 py-3 font-mono text-xs">
                <a
                  href={`https://www.npmjs.com/package/${row.name}`}
                  className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-600"
                >
                  {row.name}
                </a>
              </td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                {row.role}
                {row.note ? (
                  <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                    {row.note}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3">{row.browser ? <Check /> : <Dash />}</td>
              <td className="px-4 py-3">{row.node ? <Check /> : <Dash />}</td>
              <td className="px-4 py-3">{row.tests ? <Check /> : <Dash />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
