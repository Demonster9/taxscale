

/**
 * TaxOptimizer
 * Professional-grade tax calculation engine for Indian Income Tax Regimes (FY 2025-26).
 */
public class TaxOptimizer {

    private final double grossSalary;
    private final double perquisites;
    private final double professionalTax;
    private final double section80C;
    private final double section80D;
    private final double section80CCD_2;

    private static final double HEALTH_EDUCATION_CESS_RATE = 0.04;

    public TaxOptimizer(double grossSalary, double perquisites, double professionalTax,
                        double section80C, double section80D, double section80CCD_2) {
        this.grossSalary = grossSalary;
        this.perquisites = perquisites;
        this.professionalTax = professionalTax;
        this.section80C = section80C;
        this.section80D = section80D;
        this.section80CCD_2 = section80CCD_2;
    }

    /**
     * Calculates tax under the Old Regime.
     * Includes Standard Deduction (50k), Professional Tax, and capped 80C/80D.
     */
    public double calculateOldRegimeTax() {
        double standardDeduction = 50000.0;
        double capped80C = Math.min(section80C, 1500000.0); // Capped at 15L as per platform spec
        double capped80D = Math.min(section80D, 25000.0);

        double totalIncome = grossSalary + perquisites;
        double taxableIncome = totalIncome - standardDeduction - professionalTax - capped80C - capped80D;
        taxableIncome = Math.max(0, taxableIncome);

        double tax = 0;
        // Progressive Slabs (Old Regime)
        if (taxableIncome > 1000000) {
            tax += (taxableIncome - 1000000) * 0.30;
            taxableIncome = 1000000;
        }
        if (taxableIncome > 500000) {
            tax += (taxableIncome - 500000) * 0.20;
            taxableIncome = 500000;
        }
        if (taxableIncome > 250000) {
            tax += (taxableIncome - 250000) * 0.05;
        }

        return tax + (tax * HEALTH_EDUCATION_CESS_RATE);
    }

    /**
     * Calculates tax under the New Regime (Projections for 2025-26).
     * Includes Standard Deduction (75k), 80CCD(2), and 12L zero-tax rebate.
     */
    public double calculateNewRegimeTax() {
        double standardDeduction = 75000.0;
        double totalIncome = grossSalary + perquisites;
        double taxableIncome = totalIncome - standardDeduction - section80CCD_2;
        taxableIncome = Math.max(0, taxableIncome);

        // Section 87A Rebate: Income up to 12 Lakhs is tax-free in the 2025/26 proposal
        if (taxableIncome <= 1200000.0) {
            return 0;
        }

        double tax = 0;
        double remainingIncome = taxableIncome;

        // Progressive Slabs (New Regime 2025-26 logic)
        if (remainingIncome > 2400000) {
            tax += (remainingIncome - 2400000) * 0.30;
            remainingIncome = 2400000;
        }
        if (remainingIncome > 2000000) {
            tax += (remainingIncome - 2000000) * 0.25;
            remainingIncome = 2000000;
        }
        if (remainingIncome > 1600000) {
            tax += (remainingIncome - 1600000) * 0.20;
            remainingIncome = 1600000;
        }
        if (remainingIncome > 1200000) {
            tax += (remainingIncome - 1200000) * 0.15;
            remainingIncome = 1200000;
        }
        if (remainingIncome > 800000) {
            tax += (remainingIncome - 800000) * 0.10;
            remainingIncome = 800000;
        }
        if (remainingIncome > 400000) {
            tax += (remainingIncome - 400000) * 0.05;
        }

        return tax + (tax * HEALTH_EDUCATION_CESS_RATE);
    }

    public void printComparisonReport() {
        double oldTax = calculateOldRegimeTax();
        double newTax = calculateNewRegimeTax();
        double savings = Math.abs(oldTax - newTax);
        String recommendation = (newTax < oldTax) ? "NEW REGIME" : "OLD REGIME";

        System.out.println("======= TAX OPTIMIZATION REPORT (FY 2025-26) =======");
        System.out.printf("Gross Total Income:   INR %.2f%n", (grossSalary + perquisites));
        System.out.println("----------------------------------------------------");
        System.out.printf("Old Regime Liability: INR %.2f%n", oldTax);
        System.out.printf("New Regime Liability: INR %.2f%n", newTax);
        System.out.println("----------------------------------------------------");
        System.out.printf("Potential Savings:    INR %.2f%n", savings);
        System.out.println("RECOMMENDED REGIME:   " + recommendation);
        System.out.println("====================================================");
    }

    /**
     * Entry point for standalone execution or testing.
     */
 public static void main(String[] args) {
    // If Node doesn't pass exactly 6 arguments, exit out with an error code
    if (args.length < 6) {
        System.err.println("ERROR: Missing parameters. Required: grossSalary perquisites professionalTax 80C 80D 80CCD_2");
        System.exit(1);
    }

    // Parse the incoming strings from Node straight into double values
    double grossSalary = Double.parseDouble(args[0]);
    double perquisites = Double.parseDouble(args[1]);
    double professionalTax = Double.parseDouble(args[2]);
    double section80C = Double.parseDouble(args[3]);
    double section80D = Double.parseDouble(args[4]);
    double section80CCD_2 = Double.parseDouble(args[5]);

    TaxOptimizer profile = new TaxOptimizer(grossSalary, perquisites, professionalTax, section80C, section80D, section80CCD_2);
    
    double oldTax = profile.calculateOldRegimeTax();
    double newTax = profile.calculateNewRegimeTax();
    double savings = Math.abs(oldTax - newTax);
    String recommendation = (newTax < oldTax) ? "NEW REGIME" : "OLD REGIME";

    // Output clean, structured lines for Node to easily scan and capture
    System.out.println("oldRegimeTax:" + oldTax);
    System.out.println("newRegimeTax:" + newTax);
    System.out.println("potentialSavings:" + savings);
    System.out.println("recommendedRegime:" + recommendation);
}
}