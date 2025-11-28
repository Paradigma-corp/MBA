import React, { useMemo } from 'react';
import Select, { components } from 'react-select';
import { FixedSizeList as List } from 'react-window';

const ITEM_HEIGHT = 34;

const MenuList = (props) => {
  const { children } = props;
  const itemCount = children?.length ?? 0;
  const height = Math.min(itemCount, 10) * ITEM_HEIGHT;
  if (!itemCount) return <components.MenuList {...props} />;
  return (
    <components.MenuList {...props}>
      <List height={height} itemCount={itemCount} itemSize={ITEM_HEIGHT} width="100%">
        {({ index, style }) => <div style={style}>{children[index]}</div>}
      </List>
    </components.MenuList>
  );
};

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
      const optionMap = new Map(props.selectProps.options.map((opt) => [opt.value, opt]));
      const current = new Map(props.selectProps.value.map((opt) => [opt.value, opt]));
      tokens.forEach((token) => {
        if (optionMap.has(token)) current.set(token, optionMap.get(token));
      });
      props.selectProps.onChange(Array.from(current.values()), { action: 'paste' });
    }}
  />
);

const Option = (props) => (
  <components.Option {...props}>
    <div className="flex items-center gap-2">
      <input type="checkbox" readOnly checked={props.isSelected} className="h-3.5 w-3.5" />
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
        menuPortalTarget={document.body}
        menuPlacement="auto"
        maxMenuHeight={320}
        components={{ MenuList, MultiValueContainer, Input, Option }}
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
