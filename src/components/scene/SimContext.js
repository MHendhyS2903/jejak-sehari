import { createContext, useContext } from 'react'

export const SimContext = createContext(null)
export const useSim = () => useContext(SimContext)
