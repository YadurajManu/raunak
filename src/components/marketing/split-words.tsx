export function SplitWords({ children }: { children: string }) {
  return (
    <span>
      {children.split(" ").map((word, index) => (
        <span className="m-word-mask" key={`${word}-${index}`}>
          <span style={{ animationDelay: `${index * 0.045}s` }}>
            {word}&nbsp;
          </span>
        </span>
      ))}
    </span>
  );
}
