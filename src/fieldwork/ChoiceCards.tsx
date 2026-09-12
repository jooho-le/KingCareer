export default function ChoiceCards({
  legend,
  options,
  value,
  onChange,
  disabled = false,
}: {
  legend: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="kc-choice-cards" disabled={disabled}>
      <legend>{legend}</legend>
      {options.map((option, i) => (
        <label
          key={option.id}
          className={value === option.id ? "is-selected" : ""}
        >
          <input
            type="radio"
            name={legend}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
          />
          <span className="kc-choice-number">{i + 1}</span>
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
