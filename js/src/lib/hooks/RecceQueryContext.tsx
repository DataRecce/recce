import React, { createContext, useContext } from 'react';

export interface QueryContext {
    sqlQuery: string;
    setSqlQuery: (sqlQuery: string) => void;
}

const defaultSqlQuery = 'select * from {{ ref("mymodel") }}';

const defaultQueryContext: QueryContext = {
    sqlQuery: defaultSqlQuery,
    setSqlQuery: () => {},
};

const RecceQueryContext = createContext(defaultQueryContext);

interface QueryContextProps {
    children: React.ReactNode;
}

export function RecceQueryContextProvider({ children }: QueryContextProps) {
    const [sqlQuery, setSqlQuery] = React.useState<string>(defaultSqlQuery);
    return (
        <RecceQueryContext.Provider value={{ setSqlQuery, sqlQuery }}>
            {children}
        </RecceQueryContext.Provider>
    );
}

export const useRecceQueryContext = () => useContext(RecceQueryContext);
