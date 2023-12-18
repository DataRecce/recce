import { DefaultLineageGraphSets } from '@/components/lineage/lineage';
import React, { createContext, useContext } from 'react';

export interface LineageGraphsContext {
    lineageGraphSets?: DefaultLineageGraphSets;
    setLineageGraphSets: (lineageGraphs: any) => void;
}

const defaultLineageGraphsContext: LineageGraphsContext = {
    setLineageGraphSets: () => {},
};

const LineageGraphSets = createContext(defaultLineageGraphsContext);


interface LineageGraphSetsProps {
    children: React.ReactNode;
}

export function LineageGraphsContextProvider({ children }: LineageGraphSetsProps) {
    const [lineageGraphSets, setLineageGraphSets] = React.useState<DefaultLineageGraphSets>();
    return (
        <LineageGraphSets.Provider value={{ setLineageGraphSets, lineageGraphSets }}>
            {children}
        </LineageGraphSets.Provider>
    );
}

export const useLineageGraphsContext = () => useContext(LineageGraphSets);
