import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { AppState, INITIAL_STATE } from "./types";
import { Action } from "./actions";
import { appReducer } from "./reducer";

type StoreContextType = {
    state: AppState;
    dispatch: React.Dispatch<Action>;
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);

    return (
        <StoreContext.Provider value={{ state, dispatch }}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    const context = useContext(StoreContext);
    if (context === undefined) {
        throw new Error("useStore must be used within a StoreProvider");
    }
    return context;
}
