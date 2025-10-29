"use client";

import * as React from "react";
import { cn } from "@/libs/cn";

type TabsContextValue = {
    value: string;
    selectValue: (v: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

interface TabsProps {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
    children?: React.ReactNode;
}

export function Tabs({ defaultValue, value: valueProp, onValueChange, className, children }: TabsProps): React.ReactElement {
    const [internalValue, setInternalValue] = React.useState<string>(defaultValue ?? "");
    const isControlled = valueProp !== undefined;
    const value = isControlled ? (valueProp as string) : internalValue;

    const selectValue = (v: string) => {
        if (!isControlled) setInternalValue(v);
        onValueChange?.(v);
    };

    return (
        <TabsContext.Provider value={{ value, selectValue }}>
            <div className={cn("w-full", className)}>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
    return (
        <div role="tablist" className={cn("inline-flex items-center gap-2 rounded-md p-1", className)} {...props}>
            {children}
        </div>
    );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    value: string;
}

export function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps): React.ReactElement {
    const ctx = React.useContext(TabsContext);
    if (!ctx) throw new Error("TabsTrigger must be used within Tabs");
    const selected = ctx.value === value;
    return (
        <button
            role="tab"
            aria-selected={selected}
            data-state={selected ? "active" : "inactive"}
            onClick={() => ctx.selectValue(value)}
            className={cn(
                "px-3 py-1.5 text-sm rounded-md border transition-colors",
                selected ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps): React.ReactElement | null {
    const ctx = React.useContext(TabsContext);
    if (!ctx) throw new Error("TabsContent must be used within Tabs");
    const selected = ctx.value === value;
    if (!selected) return null;
    return (
        <div role="tabpanel" className={cn("mt-2", className)} {...props}>
            {children}
        </div>
    );
}

export default Tabs;


