import React from 'react';
import "../../styling/SegmentedControl.scss"

type SegmentedOption = {
    label: string;
    value: any;
    disabled?: boolean;
};

type SegmentedControlProps = {
    options: SegmentedOption[];
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
    className?: string;
    getOptionClassName?: (value: any) => string;
};

export default function SegmentedControl({
    options,
    value,
    onChange,
    disabled = false,
    className = "",
    getOptionClassName,
}: SegmentedControlProps) {
    return (
        <div className={`segment-btn ${className}`.trim()}>
            {options.map((option) => {
                const isSelected = Object.is(option.value, value);
                const extraClass = getOptionClassName ? getOptionClassName(option.value) : "";

                return (
                    <button
                        key={`${String(option.value)}-${option.label}`}
                        className={`segment-option ${isSelected ? "selected" : ""} ${extraClass}`.trim()}
                        type="button"
                        disabled={disabled || !!option.disabled}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}