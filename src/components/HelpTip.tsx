interface HelpTipProps {
  text: string;
}

export function HelpTip({ text }: HelpTipProps) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={text}>
      ?
      <span role="tooltip" className="help-tip-bubble">
        {text}
      </span>
    </span>
  );
}
