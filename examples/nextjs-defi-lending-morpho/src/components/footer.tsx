import DynamicLogo from "./dynamic/Logo";

interface FooterProps {
  bottomLinks?: {
    text: string;
    url: string;
  }[];
}

export default function Footer({
  bottomLinks = [
    {
      text: "GitHub",
      url: "https://github.com/dynamic-labs/examples/tree/main/examples/nextjs-defi-lending-morpho",
    },
    { text: "Docs", url: "https://docs.dynamic.xyz" },
    { text: "Dashboard", url: "https://app.dynamic.xyz" },
    { text: "Support", url: "https://www.dynamic.xyz/join-slack" },
  ],
}: FooterProps) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-t border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium">powered by</span>
            <DynamicLogo width={75} height={15} />
          </div>
          <ul className="flex gap-4">
            {bottomLinks.map((link, linkIdx) => (
              <li key={linkIdx}>
                <a
                  href={link.url}
                  className="hover:text-foreground transition-colors duration-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
