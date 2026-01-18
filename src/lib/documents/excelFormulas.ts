/**
 * EXCEL FORMULA BUILDER
 * Type-safe helper functions for generating Excel formulas
 *
 * Usage: ExcelFormulas.sum('A1', 'A10') => "=SUM(A1:A10)"
 *
 * All methods return formula strings ready for SpreadsheetCell.formula
 */

// ========================================
// CELL REFERENCE HELPERS
// ========================================

/**
 * Convert column number to Excel letter (1=A, 2=B, 27=AA)
 */
export function columnToLetter(col: number): string {
  let letter = '';
  while (col > 0) {
    const remainder = (col - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

/**
 * Create a cell reference like "A1" or "$A$1" (absolute)
 */
export function cellRef(col: number | string, row: number, absolute = false): string {
  const colLetter = typeof col === 'number' ? columnToLetter(col) : col;
  if (absolute) {
    return `$${colLetter}$${row}`;
  }
  return `${colLetter}${row}`;
}

/**
 * Create a range reference like "A1:B10"
 */
export function rangeRef(
  startCol: number | string,
  startRow: number,
  endCol: number | string,
  endRow: number
): string {
  const start = cellRef(startCol, startRow);
  const end = cellRef(endCol, endRow);
  return `${start}:${end}`;
}

// ========================================
// FORMULA BUILDERS
// ========================================

export const ExcelFormulas = {
  // ----------------------------------------
  // MATH & AGGREGATION
  // ----------------------------------------

  /**
   * Sum values in a range
   * @example ExcelFormulas.sum('A1', 'A10') => "=SUM(A1:A10)"
   */
  sum(startCell: string, endCell: string): string {
    return `=SUM(${startCell}:${endCell})`;
  },

  /**
   * Sum values in a column from row start to end
   * @example ExcelFormulas.sumColumn('B', 2, 10) => "=SUM(B2:B10)"
   */
  sumColumn(col: string, startRow: number, endRow: number): string {
    return `=SUM(${col}${startRow}:${col}${endRow})`;
  },

  /**
   * Average of values in a range
   * @example ExcelFormulas.average('A1', 'A10') => "=AVERAGE(A1:A10)"
   */
  average(startCell: string, endCell: string): string {
    return `=AVERAGE(${startCell}:${endCell})`;
  },

  /**
   * Count cells with numbers in a range
   * @example ExcelFormulas.count('A1', 'A10') => "=COUNT(A1:A10)"
   */
  count(startCell: string, endCell: string): string {
    return `=COUNT(${startCell}:${endCell})`;
  },

  /**
   * Count non-empty cells in a range
   * @example ExcelFormulas.countA('A1', 'A10') => "=COUNTA(A1:A10)"
   */
  countA(startCell: string, endCell: string): string {
    return `=COUNTA(${startCell}:${endCell})`;
  },

  /**
   * Minimum value in a range
   * @example ExcelFormulas.min('A1', 'A10') => "=MIN(A1:A10)"
   */
  min(startCell: string, endCell: string): string {
    return `=MIN(${startCell}:${endCell})`;
  },

  /**
   * Maximum value in a range
   * @example ExcelFormulas.max('A1', 'A10') => "=MAX(A1:A10)"
   */
  max(startCell: string, endCell: string): string {
    return `=MAX(${startCell}:${endCell})`;
  },

  /**
   * Round a number to specified decimal places
   * @example ExcelFormulas.round('A1', 2) => "=ROUND(A1,2)"
   */
  round(cell: string, decimals: number = 0): string {
    return `=ROUND(${cell},${decimals})`;
  },

  /**
   * Round up to specified decimal places
   * @example ExcelFormulas.roundUp('A1', 0) => "=ROUNDUP(A1,0)"
   */
  roundUp(cell: string, decimals: number = 0): string {
    return `=ROUNDUP(${cell},${decimals})`;
  },

  /**
   * Round down to specified decimal places
   * @example ExcelFormulas.roundDown('A1', 0) => "=ROUNDDOWN(A1,0)"
   */
  roundDown(cell: string, decimals: number = 0): string {
    return `=ROUNDDOWN(${cell},${decimals})`;
  },

  /**
   * Absolute value
   * @example ExcelFormulas.abs('A1') => "=ABS(A1)"
   */
  abs(cell: string): string {
    return `=ABS(${cell})`;
  },

  /**
   * Multiply values (product)
   * @example ExcelFormulas.product('A1', 'A10') => "=PRODUCT(A1:A10)"
   */
  product(startCell: string, endCell: string): string {
    return `=PRODUCT(${startCell}:${endCell})`;
  },

  /**
   * Power/exponent
   * @example ExcelFormulas.power('A1', 2) => "=POWER(A1,2)"
   */
  power(cell: string, exponent: number): string {
    return `=POWER(${cell},${exponent})`;
  },

  /**
   * Square root
   * @example ExcelFormulas.sqrt('A1') => "=SQRT(A1)"
   */
  sqrt(cell: string): string {
    return `=SQRT(${cell})`;
  },

  // ----------------------------------------
  // CONDITIONAL AGGREGATION
  // ----------------------------------------

  /**
   * Sum if condition is met
   * @example ExcelFormulas.sumIf('A1:A10', '>100') => "=SUMIF(A1:A10,">100")"
   * @example ExcelFormulas.sumIf('A1:A10', 'Yes', 'B1:B10') => "=SUMIF(A1:A10,"Yes",B1:B10)"
   */
  sumIf(range: string, criteria: string, sumRange?: string): string {
    if (sumRange) {
      return `=SUMIF(${range},"${criteria}",${sumRange})`;
    }
    return `=SUMIF(${range},"${criteria}")`;
  },

  /**
   * Sum with multiple conditions
   * @example ExcelFormulas.sumIfs('D1:D10', 'A1:A10', 'Sales', 'B1:B10', '>1000')
   */
  sumIfs(sumRange: string, ...criteriaRangePairs: string[]): string {
    const pairs = criteriaRangePairs.map((v, i) => (i % 2 === 0 ? v : `"${v}"`)).join(',');
    return `=SUMIFS(${sumRange},${pairs})`;
  },

  /**
   * Count if condition is met
   * @example ExcelFormulas.countIf('A1:A10', '>50') => "=COUNTIF(A1:A10,">50")"
   */
  countIf(range: string, criteria: string): string {
    return `=COUNTIF(${range},"${criteria}")`;
  },

  /**
   * Average if condition is met
   * @example ExcelFormulas.averageIf('A1:A10', '>0') => "=AVERAGEIF(A1:A10,">0")"
   */
  averageIf(range: string, criteria: string, avgRange?: string): string {
    if (avgRange) {
      return `=AVERAGEIF(${range},"${criteria}",${avgRange})`;
    }
    return `=AVERAGEIF(${range},"${criteria}")`;
  },

  // ----------------------------------------
  // LOGICAL
  // ----------------------------------------

  /**
   * If-then-else condition
   * @example ExcelFormulas.if('A1>100', '"High"', '"Low"') => "=IF(A1>100,"High","Low")"
   * @example ExcelFormulas.if('A1>B1', 'A1', 'B1') => "=IF(A1>B1,A1,B1)"
   */
  if(condition: string, trueValue: string, falseValue: string): string {
    return `=IF(${condition},${trueValue},${falseValue})`;
  },

  /**
   * Nested IFS (multiple conditions)
   * @example ExcelFormulas.ifs('A1>90', '"A"', 'A1>80', '"B"', 'TRUE', '"C"')
   */
  ifs(...conditionValuePairs: string[]): string {
    const pairs = conditionValuePairs.join(',');
    return `=IFS(${pairs})`;
  },

  /**
   * AND condition (all must be true)
   * @example ExcelFormulas.and('A1>0', 'B1>0') => "=AND(A1>0,B1>0)"
   */
  and(...conditions: string[]): string {
    return `=AND(${conditions.join(',')})`;
  },

  /**
   * OR condition (any must be true)
   * @example ExcelFormulas.or('A1>100', 'B1>100') => "=OR(A1>100,B1>100)"
   */
  or(...conditions: string[]): string {
    return `=OR(${conditions.join(',')})`;
  },

  /**
   * NOT condition (negate)
   * @example ExcelFormulas.not('A1>0') => "=NOT(A1>0)"
   */
  not(condition: string): string {
    return `=NOT(${condition})`;
  },

  /**
   * Return value or default if error
   * @example ExcelFormulas.ifError('A1/B1', '0') => "=IFERROR(A1/B1,0)"
   */
  ifError(formula: string, valueIfError: string): string {
    // Remove leading = if present in the formula
    const cleanFormula = formula.startsWith('=') ? formula.slice(1) : formula;
    return `=IFERROR(${cleanFormula},${valueIfError})`;
  },

  /**
   * Return value or default if #N/A
   * @example ExcelFormulas.ifNA('VLOOKUP(...)', '"Not Found"')
   */
  ifNA(formula: string, valueIfNA: string): string {
    const cleanFormula = formula.startsWith('=') ? formula.slice(1) : formula;
    return `=IFNA(${cleanFormula},${valueIfNA})`;
  },

  // ----------------------------------------
  // LOOKUP & REFERENCE
  // ----------------------------------------

  /**
   * Vertical lookup
   * @example ExcelFormulas.vlookup('A1', 'Sheet2!A:D', 3, false) => "=VLOOKUP(A1,Sheet2!A:D,3,FALSE)"
   */
  vlookup(lookupValue: string, tableArray: string, colIndex: number, exactMatch = true): string {
    return `=VLOOKUP(${lookupValue},${tableArray},${colIndex},${exactMatch ? 'FALSE' : 'TRUE'})`;
  },

  /**
   * Horizontal lookup
   * @example ExcelFormulas.hlookup('A1', 'A1:Z5', 3, false) => "=HLOOKUP(A1,A1:Z5,3,FALSE)"
   */
  hlookup(lookupValue: string, tableArray: string, rowIndex: number, exactMatch = true): string {
    return `=HLOOKUP(${lookupValue},${tableArray},${rowIndex},${exactMatch ? 'FALSE' : 'TRUE'})`;
  },

  /**
   * Modern lookup (Excel 365+)
   * @example ExcelFormulas.xlookup('A1', 'B:B', 'C:C') => "=XLOOKUP(A1,B:B,C:C)"
   */
  xlookup(
    lookupValue: string,
    lookupArray: string,
    returnArray: string,
    ifNotFound?: string
  ): string {
    if (ifNotFound) {
      return `=XLOOKUP(${lookupValue},${lookupArray},${returnArray},${ifNotFound})`;
    }
    return `=XLOOKUP(${lookupValue},${lookupArray},${returnArray})`;
  },

  /**
   * Index - return value at row/col intersection
   * @example ExcelFormulas.index('A1:D10', 2, 3) => "=INDEX(A1:D10,2,3)"
   */
  index(array: string, rowNum: number, colNum?: number): string {
    if (colNum !== undefined) {
      return `=INDEX(${array},${rowNum},${colNum})`;
    }
    return `=INDEX(${array},${rowNum})`;
  },

  /**
   * Match - find position of value in range
   * @example ExcelFormulas.match('A1', 'B:B', 0) => "=MATCH(A1,B:B,0)"
   */
  match(lookupValue: string, lookupArray: string, matchType: 0 | 1 | -1 = 0): string {
    return `=MATCH(${lookupValue},${lookupArray},${matchType})`;
  },

  /**
   * Index/Match combo (more flexible than VLOOKUP)
   * @example ExcelFormulas.indexMatch('A1', 'B:B', 'C:C') => "=INDEX(C:C,MATCH(A1,B:B,0))"
   */
  indexMatch(lookupValue: string, lookupRange: string, returnRange: string): string {
    return `=INDEX(${returnRange},MATCH(${lookupValue},${lookupRange},0))`;
  },

  // ----------------------------------------
  // TEXT
  // ----------------------------------------

  /**
   * Concatenate text
   * @example ExcelFormulas.concat('A1', '" "', 'B1') => "=CONCAT(A1," ",B1)"
   */
  concat(...values: string[]): string {
    return `=CONCAT(${values.join(',')})`;
  },

  /**
   * Left characters
   * @example ExcelFormulas.left('A1', 3) => "=LEFT(A1,3)"
   */
  left(text: string, numChars: number): string {
    return `=LEFT(${text},${numChars})`;
  },

  /**
   * Right characters
   * @example ExcelFormulas.right('A1', 3) => "=RIGHT(A1,3)"
   */
  right(text: string, numChars: number): string {
    return `=RIGHT(${text},${numChars})`;
  },

  /**
   * Middle characters
   * @example ExcelFormulas.mid('A1', 2, 3) => "=MID(A1,2,3)"
   */
  mid(text: string, startNum: number, numChars: number): string {
    return `=MID(${text},${startNum},${numChars})`;
  },

  /**
   * Length of text
   * @example ExcelFormulas.len('A1') => "=LEN(A1)"
   */
  len(text: string): string {
    return `=LEN(${text})`;
  },

  /**
   * Trim whitespace
   * @example ExcelFormulas.trim('A1') => "=TRIM(A1)"
   */
  trim(text: string): string {
    return `=TRIM(${text})`;
  },

  /**
   * Convert to uppercase
   * @example ExcelFormulas.upper('A1') => "=UPPER(A1)"
   */
  upper(text: string): string {
    return `=UPPER(${text})`;
  },

  /**
   * Convert to lowercase
   * @example ExcelFormulas.lower('A1') => "=LOWER(A1)"
   */
  lower(text: string): string {
    return `=LOWER(${text})`;
  },

  /**
   * Proper case (capitalize first letter of each word)
   * @example ExcelFormulas.proper('A1') => "=PROPER(A1)"
   */
  proper(text: string): string {
    return `=PROPER(${text})`;
  },

  /**
   * Find and replace text
   * @example ExcelFormulas.substitute('A1', '"old"', '"new"') => "=SUBSTITUTE(A1,"old","new")"
   */
  substitute(text: string, oldText: string, newText: string): string {
    return `=SUBSTITUTE(${text},${oldText},${newText})`;
  },

  /**
   * Format number as text
   * @example ExcelFormulas.text('A1', '"$#,##0.00"') => "=TEXT(A1,"$#,##0.00")"
   */
  text(value: string, formatText: string): string {
    return `=TEXT(${value},${formatText})`;
  },

  // ----------------------------------------
  // DATE & TIME
  // ----------------------------------------

  /**
   * Today's date
   * @example ExcelFormulas.today() => "=TODAY()"
   */
  today(): string {
    return '=TODAY()';
  },

  /**
   * Current date and time
   * @example ExcelFormulas.now() => "=NOW()"
   */
  now(): string {
    return '=NOW()';
  },

  /**
   * Create a date
   * @example ExcelFormulas.date(2024, 1, 15) => "=DATE(2024,1,15)"
   */
  date(year: number | string, month: number | string, day: number | string): string {
    return `=DATE(${year},${month},${day})`;
  },

  /**
   * Extract year from date
   * @example ExcelFormulas.year('A1') => "=YEAR(A1)"
   */
  year(dateCell: string): string {
    return `=YEAR(${dateCell})`;
  },

  /**
   * Extract month from date
   * @example ExcelFormulas.month('A1') => "=MONTH(A1)"
   */
  month(dateCell: string): string {
    return `=MONTH(${dateCell})`;
  },

  /**
   * Extract day from date
   * @example ExcelFormulas.day('A1') => "=DAY(A1)"
   */
  day(dateCell: string): string {
    return `=DAY(${dateCell})`;
  },

  /**
   * Difference between dates
   * @example ExcelFormulas.dateDif('A1', 'B1', 'D') => "=DATEDIF(A1,B1,"D")"
   * @param unit "Y"=years, "M"=months, "D"=days
   */
  dateDif(startDate: string, endDate: string, unit: 'Y' | 'M' | 'D'): string {
    return `=DATEDIF(${startDate},${endDate},"${unit}")`;
  },

  /**
   * Add months to a date
   * @example ExcelFormulas.edate('A1', 3) => "=EDATE(A1,3)"
   */
  edate(startDate: string, months: number): string {
    return `=EDATE(${startDate},${months})`;
  },

  /**
   * End of month
   * @example ExcelFormulas.eomonth('A1', 0) => "=EOMONTH(A1,0)"
   */
  eomonth(startDate: string, months: number): string {
    return `=EOMONTH(${startDate},${months})`;
  },

  /**
   * Network days between dates (excludes weekends)
   * @example ExcelFormulas.networkDays('A1', 'B1') => "=NETWORKDAYS(A1,B1)"
   */
  networkDays(startDate: string, endDate: string, holidays?: string): string {
    if (holidays) {
      return `=NETWORKDAYS(${startDate},${endDate},${holidays})`;
    }
    return `=NETWORKDAYS(${startDate},${endDate})`;
  },

  // ----------------------------------------
  // FINANCIAL
  // ----------------------------------------

  /**
   * Payment for a loan
   * @example ExcelFormulas.pmt(0.05/12, 360, 200000) => "=PMT(0.05/12,360,200000)"
   * @param rate Interest rate per period
   * @param nper Total number of payments
   * @param pv Present value (loan amount)
   */
  pmt(rate: string | number, nper: string | number, pv: string | number): string {
    return `=PMT(${rate},${nper},${pv})`;
  },

  /**
   * Future value of an investment
   * @example ExcelFormulas.fv(0.05/12, 120, -500) => "=FV(0.05/12,120,-500)"
   */
  fv(
    rate: string | number,
    nper: string | number,
    pmt: string | number,
    pv?: string | number
  ): string {
    if (pv !== undefined) {
      return `=FV(${rate},${nper},${pmt},${pv})`;
    }
    return `=FV(${rate},${nper},${pmt})`;
  },

  /**
   * Present value
   * @example ExcelFormulas.pv(0.05/12, 120, -500) => "=PV(0.05/12,120,-500)"
   */
  pv(rate: string | number, nper: string | number, pmt: string | number): string {
    return `=PV(${rate},${nper},${pmt})`;
  },

  /**
   * Net present value
   * @example ExcelFormulas.npv(0.1, 'B2:B10') => "=NPV(0.1,B2:B10)"
   */
  npv(rate: string | number, values: string): string {
    return `=NPV(${rate},${values})`;
  },

  /**
   * Internal rate of return
   * @example ExcelFormulas.irr('A1:A10') => "=IRR(A1:A10)"
   */
  irr(values: string, guess?: number): string {
    if (guess !== undefined) {
      return `=IRR(${values},${guess})`;
    }
    return `=IRR(${values})`;
  },

  // ----------------------------------------
  // PERCENTAGE & GROWTH
  // ----------------------------------------

  /**
   * Calculate percentage
   * @example ExcelFormulas.percent('A1', 'B1') => "=A1/B1" (format cell as %)
   */
  percent(part: string, total: string): string {
    return `=${part}/${total}`;
  },

  /**
   * Percentage change
   * @example ExcelFormulas.percentChange('A1', 'B1') => "=(B1-A1)/A1"
   */
  percentChange(oldValue: string, newValue: string): string {
    return `=(${newValue}-${oldValue})/${oldValue}`;
  },

  /**
   * Year-over-year growth
   * @example ExcelFormulas.growth('A1', 'A2') => "=(A2-A1)/A1"
   */
  growth(previousPeriod: string, currentPeriod: string): string {
    return `=(${currentPeriod}-${previousPeriod})/${previousPeriod}`;
  },

  // ----------------------------------------
  // SIMPLE ARITHMETIC
  // ----------------------------------------

  /**
   * Add two cells
   * @example ExcelFormulas.add('A1', 'B1') => "=A1+B1"
   */
  add(cell1: string, cell2: string): string {
    return `=${cell1}+${cell2}`;
  },

  /**
   * Subtract two cells
   * @example ExcelFormulas.subtract('A1', 'B1') => "=A1-B1"
   */
  subtract(cell1: string, cell2: string): string {
    return `=${cell1}-${cell2}`;
  },

  /**
   * Multiply two cells
   * @example ExcelFormulas.multiply('A1', 'B1') => "=A1*B1"
   */
  multiply(cell1: string, cell2: string): string {
    return `=${cell1}*${cell2}`;
  },

  /**
   * Divide two cells
   * @example ExcelFormulas.divide('A1', 'B1') => "=A1/B1"
   */
  divide(numerator: string, denominator: string): string {
    return `=${numerator}/${denominator}`;
  },

  /**
   * Divide with error handling (returns 0 if divide by zero)
   * @example ExcelFormulas.safeDivide('A1', 'B1') => "=IFERROR(A1/B1,0)"
   */
  safeDivide(numerator: string, denominator: string, defaultValue: string | number = 0): string {
    return `=IFERROR(${numerator}/${denominator},${defaultValue})`;
  },
};

// Export individual functions for destructuring
export const {
  sum,
  sumColumn,
  average,
  count,
  countA,
  min,
  max,
  round,
  roundUp,
  roundDown,
  abs,
  product,
  power,
  sqrt,
  sumIf,
  sumIfs,
  countIf,
  averageIf,
  vlookup,
  hlookup,
  xlookup,
  index,
  match,
  indexMatch,
  concat,
  left,
  right,
  mid,
  len,
  trim,
  upper,
  lower,
  proper,
  substitute,
  text,
  today,
  now,
  date,
  year,
  month,
  day,
  dateDif,
  edate,
  eomonth,
  networkDays,
  pmt,
  fv,
  pv,
  npv,
  irr,
  percent,
  percentChange,
  growth,
  add,
  subtract,
  multiply,
  divide,
  safeDivide,
} = ExcelFormulas;

// Also export if/and/or/not under different names to avoid JS reserved words
export const ifCondition = ExcelFormulas.if;
export const andCondition = ExcelFormulas.and;
export const orCondition = ExcelFormulas.or;
export const notCondition = ExcelFormulas.not;
export const ifsCondition = ExcelFormulas.ifs;
export const ifErrorCondition = ExcelFormulas.ifError;
export const ifNACondition = ExcelFormulas.ifNA;

export default ExcelFormulas;
