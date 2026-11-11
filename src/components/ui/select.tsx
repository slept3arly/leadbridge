"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { Children, Fragment, isValidElement, useState, type ChangeEvent, type ComponentProps, type FocusEventHandler, type KeyboardEventHandler, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SelectOption = { value: string; label: ReactNode; disabled?: boolean };
type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "placeholder"> & {
  onValueChange?: (value: string) => void;
  placeholder?: ReactNode;
};
const EMPTY_OPTION_VALUE = "__leadbridge_empty_option__";

function collectOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; disabled?: boolean; children?: ReactNode }>(child)) return [];
    if (child.type === Fragment) return collectOptions(child.props.children);
    if (typeof child.type !== "string") return [];
    if (child.type === "optgroup") return collectOptions(child.props.children);
    if (child.type !== "option") return [];
    return [{
      value: String(child.props.value ?? ""),
      label: child.props.children,
      disabled: child.props.disabled,
    }];
  });
}

/**
 * Shared Radix Select with a native-select compatible options/onChange API.
 * Existing form controls can migrate without changing their values or handlers.
 */
export function Select({
  children,
  className,
  disabled,
  placeholder: placeholderProp,
  value,
  defaultValue,
  name,
  form,
  onChange,
  onValueChange,
  onBlur,
  onFocus,
  onKeyDown,
  required,
  ...props
}: SelectProps) {
  const options = collectOptions(children);
  const placeholder = placeholderProp ?? options.find((option) => option.value === "")?.label;
  const [internalValue, setInternalValue] = useState(defaultValue === undefined ? "" : String(defaultValue));
  const rootValue = value === undefined ? internalValue : String(value);

  function setCommittedValue(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
  }

  function handleValueChange(nextValue: string) {
    const next = nextValue === EMPTY_OPTION_VALUE ? "" : nextValue;
    setCommittedValue(next);
    onValueChange?.(next);
    if (props.id) document.getElementById(props.id)?.setAttribute("data-select-value-committed", "true");
    if (onChange) {
      const target = { value: next, name, id: props.id } as HTMLSelectElement;
      onChange({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
    }
  }

  return (
    <RadixSelect.Root
      value={rootValue}
      name={name}
      form={form}
      disabled={disabled}
      required={required}
      onValueChange={handleValueChange}
    >
      <RadixSelect.Trigger
        {...props as ComponentProps<typeof RadixSelect.Trigger>}
        disabled={disabled}
        aria-required={required || undefined}
        onBlur={onBlur as FocusEventHandler<HTMLButtonElement> | undefined}
        onFocus={onFocus as FocusEventHandler<HTMLButtonElement> | undefined}
        onKeyDown={onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
        className={cn(
          "inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-left text-sm text-[var(--color-ink)] transition-all",
          "focus-visible:border-[var(--color-brand)] focus-visible:ring-3 focus-visible:ring-[var(--color-brand)]/15 focus-visible:outline-hidden",
          "aria-[invalid=true]:border-[var(--color-danger)] aria-[invalid=true]:focus-visible:ring-[var(--color-danger)]/15",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
          "data-[placeholder]:text-slate-400",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate" data-slot="select-value">
          {rootValue ? options.find((option) => option.value === rootValue)?.label ?? placeholder : placeholder}
        </span>
        <RadixSelect.Icon asChild><ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-60" /></RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className="z-[100] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-[var(--color-border)] bg-white text-[var(--color-ink)] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <RadixSelect.Viewport className="max-h-[var(--radix-select-content-available-height)] p-1">
            {options.map((option, index) => {
              const itemValue = option.value === "" ? EMPTY_OPTION_VALUE : option.value;
              return (
                <RadixSelect.Item
                  key={`${itemValue}-${index}`}
                  value={itemValue}
                  disabled={option.disabled}
                  className="relative flex min-h-9 w-full cursor-default select-none items-center whitespace-normal break-words rounded-sm py-1.5 pl-8 pr-3 text-sm outline-hidden data-[highlighted]:bg-[var(--color-brand)]/10 data-[highlighted]:text-[var(--color-ink)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <span className="absolute left-2 inline-flex size-4 items-center justify-center">
                    <RadixSelect.ItemIndicator><Check aria-hidden="true" className="size-4" /></RadixSelect.ItemIndicator>
                  </span>
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                </RadixSelect.Item>
              );
            })}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
