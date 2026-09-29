import { useEffect, useState } from 'react';
import {
  loadCalculations,
  loadHandelsplan,
  loadNewsScreenings,
  loadProfile,
  loadScreenings,
  saveCalculations,
  saveHandelsplan,
  saveNewsScreenings,
  saveProfile,
  saveScreenings,
} from '../storage';
import { fuegeNewsScreeningEin } from '../newsScreening';
import type { Calculation, Handelsplan, NewsScreeningEintrag, Profile, ScreeningEintrag } from '../types';

export function useTradeStore() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [calculations, setCalculations] = useState<Calculation[]>(() => loadCalculations());
  const [handelsplan, setHandelsplan] = useState<Handelsplan>(() => loadHandelsplan());
  const [screenings, setScreenings] = useState<ScreeningEintrag[]>(() => loadScreenings());
  const [newsScreenings, setNewsScreenings] = useState<NewsScreeningEintrag[]>(() => loadNewsScreenings());

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveCalculations(calculations), [calculations]);
  useEffect(() => saveHandelsplan(handelsplan), [handelsplan]);
  useEffect(() => saveScreenings(screenings), [screenings]);
  useEffect(() => saveNewsScreenings(newsScreenings), [newsScreenings]);

  function updateProfile(patch: Partial<Profile>) {
    setProfile((prev) => ({ ...prev, ...patch }));
  }

  function addCalculation(calculation: Calculation) {
    setCalculations((prev) => [calculation, ...prev]);
  }

  function removeCalculation(id: string) {
    setCalculations((prev) => prev.filter((entry) => entry.id !== id));
  }

  function updateCalculation(id: string, patch: Partial<Calculation>) {
    setCalculations((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function clearCalculations() {
    setCalculations([]);
  }

  function updateHandelsplan(patch: Partial<Handelsplan>) {
    setHandelsplan((prev) => ({ ...prev, ...patch }));
  }

  function addScreening(screening: ScreeningEintrag) {
    setScreenings((prev) => [screening, ...prev]);
  }

  function removeScreening(id: string) {
    setScreenings((prev) => prev.filter((entry) => entry.id !== id));
  }

  function clearScreenings() {
    setScreenings([]);
  }

  function speichereNewsScreening(eintrag: NewsScreeningEintrag) {
    setNewsScreenings((prev) => fuegeNewsScreeningEin(prev, eintrag));
  }

  function updateNewsScreening(id: string, patch: Partial<NewsScreeningEintrag>) {
    setNewsScreenings((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function removeNewsScreening(id: string) {
    setNewsScreenings((prev) => prev.filter((entry) => entry.id !== id));
  }

  return {
    profile,
    calculations,
    handelsplan,
    screenings,
    newsScreenings,
    updateProfile,
    addCalculation,
    removeCalculation,
    updateCalculation,
    clearCalculations,
    updateHandelsplan,
    addScreening,
    removeScreening,
    clearScreenings,
    speichereNewsScreening,
    updateNewsScreening,
    removeNewsScreening,
  };
}

export type TradeStore = ReturnType<typeof useTradeStore>;
