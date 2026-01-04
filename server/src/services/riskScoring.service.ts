/**
 * Risk Scoring Service
 * 
 * This service calculates student risk scores using rules-based logic.
 * Risk scoring is deterministic and does NOT use AI.
 * 
 * AI is only used for:
 * - Explaining risk scores in human language
 * - Generating intervention recommendations
 * - Summarizing risk factors
 */

export interface RiskScoreInput {
  gpa: number;
  attendanceRate: number;
  year: number;
  tuitionBalance: number;
  financialStatus: 'CLEAR' | 'PARTIAL' | 'ARREARS';
}

export interface RiskScoreResult {
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
}

/**
 * Calculate risk score based on student data
 * Uses weighted rules-based approach
 */
export function calculateRiskScore(input: RiskScoreInput): RiskScoreResult {
  const { gpa, attendanceRate, year, tuitionBalance, financialStatus } = input;
  
  let riskScore = 0;
  const riskFactors: string[] = [];

  // GPA Component (0-40 points)
  // Lower GPA = Higher Risk
  if (gpa < 2.0) {
    riskScore += 40;
    riskFactors.push('Critical GPA: Below 2.0 (Academic Probation)');
  } else if (gpa < 2.5) {
    riskScore += 30;
    riskFactors.push('Low GPA: Below 2.5 (Academic Warning)');
  } else if (gpa < 3.0) {
    riskScore += 20;
    riskFactors.push('Below Average GPA: Below 3.0');
  } else if (gpa < 3.5) {
    riskScore += 10;
  }

  // Attendance Component (0-30 points)
  // Lower Attendance = Higher Risk
  if (attendanceRate < 50) {
    riskScore += 30;
    riskFactors.push('Critical Attendance: Below 50%');
  } else if (attendanceRate < 60) {
    riskScore += 25;
    riskFactors.push('Poor Attendance: Below 60%');
  } else if (attendanceRate < 70) {
    riskScore += 15;
    riskFactors.push('Low Attendance: Below 70%');
  } else if (attendanceRate < 80) {
    riskScore += 8;
    riskFactors.push('Below Target Attendance: Below 80%');
  }

  // Financial Component (0-25 points)
  // Higher Debt + ARREARS = Higher Risk
  if (financialStatus === 'ARREARS') {
    if (tuitionBalance > 2000000) {
      riskScore += 25;
      riskFactors.push('Severe Financial Arrears: Over 2M UGX');
    } else if (tuitionBalance > 1000000) {
      riskScore += 20;
      riskFactors.push('Significant Financial Arrears: Over 1M UGX');
    } else {
      riskScore += 15;
      riskFactors.push('Financial Arrears: Outstanding Balance');
    }
  } else if (financialStatus === 'PARTIAL') {
    if (tuitionBalance > 1000000) {
      riskScore += 12;
      riskFactors.push('Partial Payment: Large Outstanding Balance');
    } else {
      riskScore += 8;
      riskFactors.push('Partial Payment: Outstanding Balance');
    }
  }

  // Year Component (0-5 points)
  // Early years (1-2) may have adjustment issues
  if (year === 1) {
    riskScore += 2; // Slight adjustment risk
  } else if (year === 2 && riskScore > 50) {
    riskScore += 3; // Second year with existing issues
  }

  // Cap at 100
  riskScore = Math.min(100, Math.max(0, Math.round(riskScore)));

  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (riskScore >= 70) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 40) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  // If no specific factors identified but score is medium/high, add generic factor
  if (riskFactors.length === 0 && riskScore >= 40) {
    riskFactors.push('Multiple Risk Indicators Present');
  }

  return {
    riskScore,
    riskLevel,
    riskFactors,
  };
}

