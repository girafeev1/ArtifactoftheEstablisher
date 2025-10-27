import React, { createContext, useContext } from 'react'

export const PromptIdContext = createContext('')
export const PromptIdProvider = PromptIdContext.Provider
export function usePromptId(): string {
  return useContext(PromptIdContext)
}
