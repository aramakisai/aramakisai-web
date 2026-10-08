interface SignageHeadingChipProps {
  /** Material Symbols のアイコン名。layout.tsx の icon_names に無い名前は豆腐になる */
  readonly icon: string;
  readonly label: string;
}

export function SignageHeadingChip({ icon, label }: SignageHeadingChipProps) {
  return (
    <div className="absolute left-6 top-6 flex items-center gap-2 whitespace-nowrap rounded-lg bg-text px-5 py-2.5 font-display text-[32px] font-bold leading-none text-background">
      <span aria-hidden="true" className="material-symbols-sharp text-[32px]">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}
