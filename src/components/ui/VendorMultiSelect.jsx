import React, { useMemo } from 'react';
import Select, { components } from 'react-select';

const MultiValueContainer = (props) => {
  const selected = props.getValue();
  const index = selected.findIndex((item) => item.value === props.data.value);
  if (index >= 2) {
    if (index === 2) {
      const remaining = selected.length - 2;
      return <span className="text-[11px] text-slate-500 px-1">+{remaining}</span>;
    }
    return null;
  }
  return <components.MultiValueContainer {...props} />;
};

const Input = (props) => (
  <components.Input
    {...props}
    onPaste={(event) => {
      const text = event.clipboardData.getData('Text');
      if (!text.includes(',') && !text.includes(';')) return;
      event.preventDefault();
      const tokens = text
        .split(/[,;]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      if (!tokens.length) return;
      const optionMap = new Map(
        (props.selectProps.options || [])
          .flatMap((opt) => (opt.options ? opt.options : [opt]))
          .map((opt) => [opt.value, opt]),
      );
      const current = new Map(props.selectProps.value.map((opt) => [opt.value, opt]));
      tokens.forEach((token) => {
        if (optionMap.has(token)) current.set(token, optionMap.get(token));
      });
      props.selectProps.onChange(Array.from(current.values()), { action: 'paste' });
    }}
  />
);

const Checkbox = ({ checked }) => (
  <span
    className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition ${
      checked ? 'bg-celeste-600 border-celeste-600' : 'bg-white border-slate-300'
    }`}
    aria-hidden="true"
  >
    {checked && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
  </span>
);

const Option = (props) => (
  <components.Option {...props}>
    <div className="flex items-center gap-2">
      <Checkbox checked={props.isSelected} />
      <span className="text-sm text-slate-800">{props.label}</span>
      {props.data.line && <span className="ml-auto text-[11px] text-slate-500">{props.data.line}</span>}
    </div>
  </components.Option>
);

const VendorMultiSelect = ({ options = [], valueSet, onChange, placeholder = 'Selecciona vendedores' }) => {
  const groupedOptions = useMemo(() => {
    const grouped = options.reduce((acc, option) => {
      const key = option.line || '—';
      if (!acc[key]) acc[key] = [];
      acc[key].push(option);
      return acc;
    }, {});
    return Object.entries(grouped).map(([label, opts]) => ({ label, options: opts }));
  }, [options]);

  const value = useMemo(() => options.filter((opt) => valueSet?.has(opt.value)), [options, valueSet]);

  const menuPortalTarget = typeof document !== 'undefined' ? document.body : undefined;

  const handleChange = (selected) => {
    const nextSet = new Set((selected ?? []).map((opt) => opt.value));
    onChange(nextSet);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Vendedor</span>
        <div className="flex items-center gap-2">
          <button type="button" className="text-celeste-700 hover:text-celeste-800" onClick={() => onChange(new Set())}>
            Limpiar
          </button>
          <button
            type="button"
            className="text-celeste-700 hover:text-celeste-800"
            onClick={() => onChange(new Set(options.map((opt) => opt.value)))}
          >
            Seleccionar todos
          </button>
        </div>
      </div>
      <Select
        options={groupedOptions}
        placeholder={placeholder}
        isMulti
        isClearable
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        classNamePrefix="vendor-select"
        styles={{
          control: (base) => ({ ...base, minHeight: 44, borderRadius: 12, borderColor: '#cbd5e1' }),
          multiValue: (base) => ({ ...base, borderRadius: 10, backgroundColor: '#e2e8f0' }),
          valueContainer: (base) => ({ ...base, gap: 4, paddingLeft: 10 }),
          menu: (base) => ({ ...base, zIndex: 50 }),
        }}
        menuPortalTarget={menuPortalTarget}
        menuPosition="fixed"
        menuPlacement="auto"
        maxMenuHeight={320}
        components={{ MultiValueContainer, Input, Option }}
        value={value}
        onChange={handleChange}
        className="w-full"
        noOptionsMessage={() => 'Sin coincidencias'}
        inputId="vendors-search"
        aria-label="Selecciona vendedores"
      />
    </div>
  );
};

export default VendorMultiSelect;
