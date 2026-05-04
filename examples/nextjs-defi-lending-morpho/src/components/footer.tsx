export default function Footer() {
  return (
    <footer className="border-t border-[#DADADA] py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-2">
        <span className="text-xs text-[#606060]">Powered by</span>
        <a
          href="https://www.dynamic.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[#4779FF] hover:underline"
        >
          Dynamic
        </a>
      </div>
    </footer>
  );
}
