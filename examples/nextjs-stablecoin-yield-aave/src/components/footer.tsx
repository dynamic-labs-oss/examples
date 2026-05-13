import DynamicLogo from "./dynamic/logo";

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-[#DADADA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-[#606060]">
          <div className="flex items-center gap-2">
            <span className="font-medium">powered by</span>
            <DynamicLogo width={75} height={15} />
          </div>
          <ul className="flex gap-4">
            <li>
              <a
                href="https://github.com/dynamic-labs/examples/tree/main/examples/nextjs-stablecoin-yield-aave"
                className="hover:text-[#030303] transition-colors duration-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                href="https://docs.dynamic.xyz"
                className="hover:text-[#030303] transition-colors duration-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                Docs
              </a>
            </li>
            <li>
              <a
                href="https://app.dynamic.xyz"
                className="hover:text-[#030303] transition-colors duration-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                Dashboard
              </a>
            </li>
            <li>
              <a
                href="https://www.dynamic.xyz/join-slack"
                className="hover:text-[#030303] transition-colors duration-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                Support
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
