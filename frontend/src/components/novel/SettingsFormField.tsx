export default function SettingsFormField({ settingKey }: { settingKey: string }) {
  return (
    <div className="flex items-center justify-center h-full text-base-content/40 text-sm">
      [SettingsFormField: {settingKey}]
    </div>
  );
}
