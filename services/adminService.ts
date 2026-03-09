
export interface Operator {
  id: string;
  name: string;
  pin: string;
}

export interface Customer {
  id: string;
  name: string;
  location: string;
  transport: string;
}

const OPERATORS_KEY = 'radiance_dispatch_operators';
const CUSTOMERS_KEY = 'radiance_dispatch_customers';

const defaultOperators: Operator[] = [
  { id: '0001', name: 'Prajval Kulkarni', pin: '0001' },
  { id: '0002', name: 'Ravi Tiwari', pin: '0002' },
  { id: '0003', name: 'Sai More', pin: '0003' },
];

const defaultCustomers: Customer[] = [
  { id: '1', name: "FLEETGUARD FILTERS PVT LTD (DHARWAD)", location: "DHARWAD", transport: "AJK TRANSPORT" },
  { id: '2', name: "FLEETGUARD FILTERS PVT LTD (HOSUR)", location: "HOSUR", transport: "RENUKA LOGISTIC SERVICES" },
  { id: '3', name: "FLEETGUARD FILTERS PVT LTD (SITARGANJ)", location: "SITARGANJ", transport: "SINGH ROADLINES" },
  { id: '4', name: "FLEETGUARD FILTERS PVT LTD (NANDUR)", location: "NANDUR", transport: "MANGAL MURTI TRANSPORT SERVICES" },
  { id: '5', name: "FLEETGUARD FILTERS PVT LTD (LONI)", location: "LONI", transport: "RENUKA LOGISTIC SERVICES" },
  { id: '6', name: "FLEETGUARD FILTERS PVT LTD (WADKI)", location: "WADKI", transport: "MODAK TRANSPORT" },
  { id: '7', name: "KINETIC ELECTRIC MOTOR CO PVT LTD", location: "TAKAWE", transport: "SHIVKRUPA TRANSPORT" },
  { id: '8', name: "ITW INDIA PVT LTD", location: "SANASWADI", transport: "RAJENDRA TRANSPORT" }
];

export const adminService = {
  getOperators(): Operator[] {
    const saved = localStorage.getItem(OPERATORS_KEY);
    if (!saved) {
      this.saveOperators(defaultOperators);
      return defaultOperators;
    }
    try {
      return JSON.parse(saved);
    } catch {
      return defaultOperators;
    }
  },

  saveOperators(operators: Operator[]): void {
    localStorage.setItem(OPERATORS_KEY, JSON.stringify(operators));
  },

  getCustomers(): Customer[] {
    const saved = localStorage.getItem(CUSTOMERS_KEY);
    if (!saved) {
      this.saveCustomers(defaultCustomers);
      return defaultCustomers;
    }
    try {
      return JSON.parse(saved);
    } catch {
      return defaultCustomers;
    }
  },

  saveCustomers(customers: Customer[]): void {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  },

  validateLogin(pin: string): Operator | 'ADMIN' | null {
    if (pin === '1234') return 'ADMIN';
    const operators = this.getOperators();
    return operators.find(o => o.pin === pin) || null;
  }
};
