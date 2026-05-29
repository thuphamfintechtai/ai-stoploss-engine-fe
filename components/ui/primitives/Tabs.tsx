import React, { createContext, useContext, useState } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  defaultValue: string;
  value?: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value,
  onChange,
  children,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (tab: string) => {
    if (!value) setInternalValue(tab);
    onChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabList: React.FC<TabListProps> = ({ children, className = '' }) => (
  <div className={`tabs ${className}`} role="tablist">
    {children}
  </div>
);

interface TabProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const Tab: React.FC<TabProps> = ({
  value,
  children,
  disabled = false,
  className = '',
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab must be used within Tabs');

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      className={`tab ${isActive ? 'tab-active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={() => !disabled && setActiveTab(value)}
    >
      {children}
    </button>
  );
};

interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ value, children, className = '' }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be used within Tabs');

  if (context.activeTab !== value) return null;

  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
};

export const TabsCompact: React.FC<{
  tabs: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}> = ({ tabs, value, onChange, className = '' }) => (
  <div className={`flex gap-1 p-1 bg-elevated rounded-lg ${className}`}>
    {tabs.map((tab) => (
      <button
        key={tab.value}
        onClick={() => onChange(tab.value)}
        className={`px-3 py-1.5 text-body-sm font-medium rounded-md transition-base ${
          value === tab.value
            ? 'bg-panel text-main shadow-sm'
            : 'text-muted hover:text-main'
        }`}
      >
        {tab.label}
        {tab.count !== undefined && (
          <span className={`ml-1.5 text-caption ${value === tab.value ? 'text-accent' : 'text-dim'}`}>
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
);
