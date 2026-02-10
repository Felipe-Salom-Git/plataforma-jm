import {
    getDocs,
    query,
    where,
    orderBy
} from "firebase/firestore";
import { getTenantCollection } from "../firebase/firestore";
import { Presupuesto, Gasto } from "../types";
import { startOfMonth, subMonths, endOfMonth, startOfDay, endOfDay, subDays, eachDayOfInterval, format } from "date-fns";
import { es } from "date-fns/locale";

export interface AdminStats {
    daily: {
        income: number;
        expenses: number;
        profit: number;
    };
    monthly: {
        income: number;
        expenses: number;
        profit: number;
        prevIncome: number;
        incomeChangeParams: number; // % change based on income
    };
    chartData: {
        name: string; // "Ene", "Feb"...
        ingresos: number;
        gastos: number;
        ganancia: number;
    }[];
    last30Days: {
        date: string;
        ganancia: number;
    }[];
}

export const AdminService = {
    getStats: async (): Promise<AdminStats> => {
        const now = new Date();
        const currentMonthStart = startOfMonth(now).getTime();
        const currentDayStart = startOfDay(now).getTime();

        // 1. Fetch ALL Income (Quotes) - optimization: could filter by approximate date if data is huge
        // For "Admin", usually we want historical data for charts. 
        // Let's fetch last 6-12 months? Or just all for now (simpler, assumes not thousands of docs yet).
        const quotesRef = getTenantCollection("presupuestos");
        // We only care about Approved/Completed for "Income". 
        // Or "Cobrado" (payments)? User request said: "ingresos: quotes aceptados / trackings facturados".
        // Let's stick to Approved Quotes total for simplicity as requested ("quotes aceptados"), 
        // unless they have payments. 
        // Better: Use `pagos` array if available? 
        // The Prompt said: "ingresos: quotes aceptados". Let's use Quote Total for approved quotes.

        const quotesQ = query(quotesRef, where("estado", "in", ["approved", "in_progress", "completed", "done"]));
        const quotesSnap = await getDocs(quotesQ);
        const quotes = quotesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Presupuesto));

        // 2. Fetch ALL Expenses
        const gastosRef = getTenantCollection("gastos");
        const gastosQ = query(gastosRef, orderBy("fecha", "desc")); // Optimization: limit date range
        const gastosSnap = await getDocs(gastosQ);
        const gastos = gastosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Gasto));

        // --- Aggregations ---

        // Helper: Is in current day?
        const isToday = (ts: number) => ts >= currentDayStart;
        // Helper: Is in current month?
        const isThisMonth = (ts: number) => ts >= currentMonthStart;
        // Helper: Is last month?
        const prevMonthStart = startOfMonth(subMonths(now, 1)).getTime();
        const prevMonthEnd = endOfMonth(subMonths(now, 1)).getTime();
        const isLastMonth = (ts: number) => ts >= prevMonthStart && ts <= prevMonthEnd;

        // Daily
        const dailyIncome = quotes
            .filter(q => q.approvedAt && isToday(q.approvedAt))
            // Fallback: if approvedAt missing, use updatedAt or createdAt? 
            // Let's use updated/created if approvedAt missing for now, but ideally we set approvedAt.
            // Actually, if we use `pagos` it's more accurate for "Cash Flow", but request said "quotes aceptados".
            // We'll use `total` of quotes approved today.
            .reduce((sum, q) => sum + (q.total || 0), 0);

        const dailyExpenses = gastos
            .filter(g => isToday(g.fecha))
            .reduce((sum, g) => sum + (g.monto || 0), 0);

        // Monthly
        const monthlyIncome = quotes
            .filter(q => q.approvedAt ? isThisMonth(q.approvedAt) : (q.createdAt >= currentMonthStart && ['approved', 'in_progress', 'completed'].includes(q.estado)))
            .reduce((sum, q) => sum + (q.total || 0), 0);

        const monthlyExpenses = gastos
            .filter(g => isThisMonth(g.fecha))
            .reduce((sum, g) => sum + (g.monto || 0), 0);

        // Prev Month for Comparison
        const prevIncome = quotes
            .filter(q => q.approvedAt ? isLastMonth(q.approvedAt) : (q.createdAt >= prevMonthStart && q.createdAt <= prevMonthEnd && ['approved', 'in_progress', 'completed'].includes(q.estado)))
            .reduce((sum, q) => sum + (q.total || 0), 0);

        const incomeChange = prevIncome === 0 ? 100 : ((monthlyIncome - prevIncome) / prevIncome) * 100;

        // --- Charts Data ---

        // 1. Last 6 Months Bars
        const monthsChartData = [];
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(now, i);
            const mStart = startOfMonth(d).getTime();
            const mEnd = endOfMonth(d).getTime();

            const inc = quotes
                .filter(q => {
                    const date = q.approvedAt || q.createdAt;
                    return date >= mStart && date <= mEnd;
                })
                .reduce((s, q) => s + (q.total || 0), 0);

            const exp = gastos
                .filter(g => g.fecha >= mStart && g.fecha <= mEnd)
                .reduce((s, g) => s + (g.monto || 0), 0);

            monthsChartData.push({
                name: format(d, 'MMM', { locale: es }), // Ene, Feb
                ingresos: inc,
                gastos: exp,
                ganancia: inc - exp
            });
        }

        // 2. Last 30 Days Line
        const daysChartData = [];
        const last30 = eachDayOfInterval({ start: subDays(now, 29), end: now });

        for (const d of last30) {
            const dayStart = startOfDay(d).getTime();
            const dayEnd = endOfDay(d).getTime();

            const inc = quotes
                .filter(q => {
                    const date = q.approvedAt || q.createdAt;
                    return date >= dayStart && date <= dayEnd;
                })
                .reduce((s, q) => s + (q.total || 0), 0);

            const exp = gastos
                .filter(g => g.fecha >= dayStart && g.fecha <= dayEnd)
                .reduce((s, g) => s + (g.monto || 0), 0);

            daysChartData.push({
                date: format(d, 'dd/MM'),
                ganancia: inc - exp
            });
        }

        return {
            daily: {
                income: dailyIncome,
                expenses: dailyExpenses,
                profit: dailyIncome - dailyExpenses
            },
            monthly: {
                income: monthlyIncome,
                expenses: monthlyExpenses,
                profit: monthlyIncome - monthlyExpenses,
                prevIncome,
                incomeChangeParams: incomeChange
            },
            chartData: monthsChartData,
            last30Days: daysChartData
        }
    }
};
