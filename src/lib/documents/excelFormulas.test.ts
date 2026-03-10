import { describe, it, expect } from 'vitest';
import {
  columnToLetter,
  cellRef,
  rangeRef,
  ExcelFormulas,
  ifCondition,
  andCondition,
  orCondition,
  notCondition,
  ifErrorCondition,
} from './excelFormulas';

// -------------------------------------------------------------------
// Cell Reference Helpers
// -------------------------------------------------------------------
describe('columnToLetter', () => {
  it('should convert 1 to A', () => expect(columnToLetter(1)).toBe('A'));
  it('should convert 2 to B', () => expect(columnToLetter(2)).toBe('B'));
  it('should convert 26 to Z', () => expect(columnToLetter(26)).toBe('Z'));
  it('should convert 27 to AA', () => expect(columnToLetter(27)).toBe('AA'));
  it('should convert 52 to AZ', () => expect(columnToLetter(52)).toBe('AZ'));
  it('should convert 53 to BA', () => expect(columnToLetter(53)).toBe('BA'));
});

describe('cellRef', () => {
  it('should create ref from number col', () => expect(cellRef(1, 1)).toBe('A1'));
  it('should create ref from string col', () => expect(cellRef('B', 5)).toBe('B5'));
  it('should create absolute ref', () => expect(cellRef(1, 1, true)).toBe('$A$1'));
  it('should create absolute ref from string', () => expect(cellRef('C', 3, true)).toBe('$C$3'));
});

describe('rangeRef', () => {
  it('should create range from numbers', () => expect(rangeRef(1, 1, 3, 10)).toBe('A1:C10'));
  it('should create range from strings', () => expect(rangeRef('A', 1, 'D', 20)).toBe('A1:D20'));
});

// -------------------------------------------------------------------
// Math & Aggregation
// -------------------------------------------------------------------
describe('ExcelFormulas - Math', () => {
  it('sum', () => expect(ExcelFormulas.sum('A1', 'A10')).toBe('=SUM(A1:A10)'));
  it('sumColumn', () => expect(ExcelFormulas.sumColumn('B', 2, 10)).toBe('=SUM(B2:B10)'));
  it('average', () => expect(ExcelFormulas.average('A1', 'A10')).toBe('=AVERAGE(A1:A10)'));
  it('count', () => expect(ExcelFormulas.count('A1', 'A10')).toBe('=COUNT(A1:A10)'));
  it('countA', () => expect(ExcelFormulas.countA('A1', 'A10')).toBe('=COUNTA(A1:A10)'));
  it('min', () => expect(ExcelFormulas.min('A1', 'A10')).toBe('=MIN(A1:A10)'));
  it('max', () => expect(ExcelFormulas.max('A1', 'A10')).toBe('=MAX(A1:A10)'));
  it('round', () => expect(ExcelFormulas.round('A1', 2)).toBe('=ROUND(A1,2)'));
  it('round default', () => expect(ExcelFormulas.round('A1')).toBe('=ROUND(A1,0)'));
  it('roundUp', () => expect(ExcelFormulas.roundUp('A1', 0)).toBe('=ROUNDUP(A1,0)'));
  it('roundDown', () => expect(ExcelFormulas.roundDown('A1', 1)).toBe('=ROUNDDOWN(A1,1)'));
  it('abs', () => expect(ExcelFormulas.abs('A1')).toBe('=ABS(A1)'));
  it('product', () => expect(ExcelFormulas.product('A1', 'A10')).toBe('=PRODUCT(A1:A10)'));
  it('power', () => expect(ExcelFormulas.power('A1', 2)).toBe('=POWER(A1,2)'));
  it('sqrt', () => expect(ExcelFormulas.sqrt('A1')).toBe('=SQRT(A1)'));
});

// -------------------------------------------------------------------
// Conditional Aggregation
// -------------------------------------------------------------------
describe('ExcelFormulas - Conditional', () => {
  it('sumIf', () => expect(ExcelFormulas.sumIf('A1:A10', '>100')).toBe('=SUMIF(A1:A10,">100")'));
  it('sumIf with sumRange', () =>
    expect(ExcelFormulas.sumIf('A1:A10', 'Yes', 'B1:B10')).toBe('=SUMIF(A1:A10,"Yes",B1:B10)'));
  it('sumIfs', () =>
    expect(ExcelFormulas.sumIfs('D1:D10', 'A1:A10', 'Sales', 'B1:B10', '>1000')).toBe(
      '=SUMIFS(D1:D10,A1:A10,"Sales",B1:B10,">1000")'
    ));
  it('countIf', () =>
    expect(ExcelFormulas.countIf('A1:A10', '>50')).toBe('=COUNTIF(A1:A10,">50")'));
  it('averageIf', () =>
    expect(ExcelFormulas.averageIf('A1:A10', '>0')).toBe('=AVERAGEIF(A1:A10,">0")'));
  it('averageIf with avgRange', () =>
    expect(ExcelFormulas.averageIf('A1:A10', '>0', 'B1:B10')).toBe(
      '=AVERAGEIF(A1:A10,">0",B1:B10)'
    ));
});

// -------------------------------------------------------------------
// Logical
// -------------------------------------------------------------------
describe('ExcelFormulas - Logical', () => {
  it('if', () =>
    expect(ExcelFormulas.if('A1>100', '"High"', '"Low"')).toBe('=IF(A1>100,"High","Low")'));
  it('ifs', () =>
    expect(ExcelFormulas.ifs('A1>90', '"A"', 'A1>80', '"B"')).toBe('=IFS(A1>90,"A",A1>80,"B")'));
  it('and', () => expect(ExcelFormulas.and('A1>0', 'B1>0')).toBe('=AND(A1>0,B1>0)'));
  it('or', () => expect(ExcelFormulas.or('A1>100', 'B1>100')).toBe('=OR(A1>100,B1>100)'));
  it('not', () => expect(ExcelFormulas.not('A1>0')).toBe('=NOT(A1>0)'));
  it('ifError', () => expect(ExcelFormulas.ifError('A1/B1', '0')).toBe('=IFERROR(A1/B1,0)'));
  it('ifError strips leading =', () =>
    expect(ExcelFormulas.ifError('=A1/B1', '0')).toBe('=IFERROR(A1/B1,0)'));
  it('ifNA', () =>
    expect(ExcelFormulas.ifNA('VLOOKUP(A1,B:D,2)', '"N/A"')).toBe(
      '=IFNA(VLOOKUP(A1,B:D,2),"N/A")'
    ));
});

// -------------------------------------------------------------------
// Lookup
// -------------------------------------------------------------------
describe('ExcelFormulas - Lookup', () => {
  it('vlookup exact', () =>
    expect(ExcelFormulas.vlookup('A1', 'Sheet2!A:D', 3)).toBe('=VLOOKUP(A1,Sheet2!A:D,3,FALSE)'));
  it('vlookup approximate', () =>
    expect(ExcelFormulas.vlookup('A1', 'B:D', 2, false)).toBe('=VLOOKUP(A1,B:D,2,TRUE)'));
  it('hlookup', () =>
    expect(ExcelFormulas.hlookup('A1', 'A1:Z5', 3)).toBe('=HLOOKUP(A1,A1:Z5,3,FALSE)'));
  it('xlookup', () =>
    expect(ExcelFormulas.xlookup('A1', 'B:B', 'C:C')).toBe('=XLOOKUP(A1,B:B,C:C)'));
  it('xlookup with fallback', () =>
    expect(ExcelFormulas.xlookup('A1', 'B:B', 'C:C', '"Not Found"')).toBe(
      '=XLOOKUP(A1,B:B,C:C,"Not Found")'
    ));
  it('index with row and col', () =>
    expect(ExcelFormulas.index('A1:D10', 2, 3)).toBe('=INDEX(A1:D10,2,3)'));
  it('index with row only', () =>
    expect(ExcelFormulas.index('A1:A10', 5)).toBe('=INDEX(A1:A10,5)'));
  it('match', () => expect(ExcelFormulas.match('A1', 'B:B')).toBe('=MATCH(A1,B:B,0)'));
  it('indexMatch', () =>
    expect(ExcelFormulas.indexMatch('A1', 'B:B', 'C:C')).toBe('=INDEX(C:C,MATCH(A1,B:B,0))'));
});

// -------------------------------------------------------------------
// Text
// -------------------------------------------------------------------
describe('ExcelFormulas - Text', () => {
  it('concat', () => expect(ExcelFormulas.concat('A1', '" "', 'B1')).toBe('=CONCAT(A1," ",B1)'));
  it('left', () => expect(ExcelFormulas.left('A1', 3)).toBe('=LEFT(A1,3)'));
  it('right', () => expect(ExcelFormulas.right('A1', 3)).toBe('=RIGHT(A1,3)'));
  it('mid', () => expect(ExcelFormulas.mid('A1', 2, 3)).toBe('=MID(A1,2,3)'));
  it('len', () => expect(ExcelFormulas.len('A1')).toBe('=LEN(A1)'));
  it('trim', () => expect(ExcelFormulas.trim('A1')).toBe('=TRIM(A1)'));
  it('upper', () => expect(ExcelFormulas.upper('A1')).toBe('=UPPER(A1)'));
  it('lower', () => expect(ExcelFormulas.lower('A1')).toBe('=LOWER(A1)'));
  it('proper', () => expect(ExcelFormulas.proper('A1')).toBe('=PROPER(A1)'));
  it('substitute', () =>
    expect(ExcelFormulas.substitute('A1', '"old"', '"new"')).toBe('=SUBSTITUTE(A1,"old","new")'));
  it('text', () => expect(ExcelFormulas.text('A1', '"$#,##0.00"')).toBe('=TEXT(A1,"$#,##0.00")'));
});

// -------------------------------------------------------------------
// Date & Time
// -------------------------------------------------------------------
describe('ExcelFormulas - Date', () => {
  it('today', () => expect(ExcelFormulas.today()).toBe('=TODAY()'));
  it('now', () => expect(ExcelFormulas.now()).toBe('=NOW()'));
  it('date', () => expect(ExcelFormulas.date(2024, 1, 15)).toBe('=DATE(2024,1,15)'));
  it('year', () => expect(ExcelFormulas.year('A1')).toBe('=YEAR(A1)'));
  it('month', () => expect(ExcelFormulas.month('A1')).toBe('=MONTH(A1)'));
  it('day', () => expect(ExcelFormulas.day('A1')).toBe('=DAY(A1)'));
  it('dateDif', () => expect(ExcelFormulas.dateDif('A1', 'B1', 'D')).toBe('=DATEDIF(A1,B1,"D")'));
  it('edate', () => expect(ExcelFormulas.edate('A1', 3)).toBe('=EDATE(A1,3)'));
  it('eomonth', () => expect(ExcelFormulas.eomonth('A1', 0)).toBe('=EOMONTH(A1,0)'));
  it('networkDays', () =>
    expect(ExcelFormulas.networkDays('A1', 'B1')).toBe('=NETWORKDAYS(A1,B1)'));
  it('networkDays with holidays', () =>
    expect(ExcelFormulas.networkDays('A1', 'B1', 'C1:C5')).toBe('=NETWORKDAYS(A1,B1,C1:C5)'));
});

// -------------------------------------------------------------------
// Financial
// -------------------------------------------------------------------
describe('ExcelFormulas - Financial', () => {
  it('pmt', () =>
    expect(ExcelFormulas.pmt('0.05/12', 360, 200000)).toBe('=PMT(0.05/12,360,200000)'));
  it('fv', () => expect(ExcelFormulas.fv('0.05/12', 120, -500)).toBe('=FV(0.05/12,120,-500)'));
  it('fv with pv', () =>
    expect(ExcelFormulas.fv('0.05/12', 120, -500, 10000)).toBe('=FV(0.05/12,120,-500,10000)'));
  it('pv', () => expect(ExcelFormulas.pv('0.05/12', 120, -500)).toBe('=PV(0.05/12,120,-500)'));
  it('npv', () => expect(ExcelFormulas.npv(0.1, 'B2:B10')).toBe('=NPV(0.1,B2:B10)'));
  it('irr', () => expect(ExcelFormulas.irr('A1:A10')).toBe('=IRR(A1:A10)'));
  it('irr with guess', () => expect(ExcelFormulas.irr('A1:A10', 0.1)).toBe('=IRR(A1:A10,0.1)'));
});

// -------------------------------------------------------------------
// Percentage & Growth
// -------------------------------------------------------------------
describe('ExcelFormulas - Percentage', () => {
  it('percent', () => expect(ExcelFormulas.percent('A1', 'B1')).toBe('=A1/B1'));
  it('percentChange', () => expect(ExcelFormulas.percentChange('A1', 'B1')).toBe('=(B1-A1)/A1'));
  it('growth', () => expect(ExcelFormulas.growth('A1', 'A2')).toBe('=(A2-A1)/A1'));
});

// -------------------------------------------------------------------
// Arithmetic
// -------------------------------------------------------------------
describe('ExcelFormulas - Arithmetic', () => {
  it('add', () => expect(ExcelFormulas.add('A1', 'B1')).toBe('=A1+B1'));
  it('subtract', () => expect(ExcelFormulas.subtract('A1', 'B1')).toBe('=A1-B1'));
  it('multiply', () => expect(ExcelFormulas.multiply('A1', 'B1')).toBe('=A1*B1'));
  it('divide', () => expect(ExcelFormulas.divide('A1', 'B1')).toBe('=A1/B1'));
  it('safeDivide', () => expect(ExcelFormulas.safeDivide('A1', 'B1')).toBe('=IFERROR(A1/B1,0)'));
  it('safeDivide with custom default', () =>
    expect(ExcelFormulas.safeDivide('A1', 'B1', '"N/A"')).toBe('=IFERROR(A1/B1,"N/A")'));
});

// -------------------------------------------------------------------
// Renamed exports (avoid JS reserved words)
// -------------------------------------------------------------------
describe('Renamed exports', () => {
  it('ifCondition', () =>
    expect(ifCondition('A1>0', '"Yes"', '"No"')).toBe('=IF(A1>0,"Yes","No")'));
  it('andCondition', () => expect(andCondition('A1>0')).toBe('=AND(A1>0)'));
  it('orCondition', () => expect(orCondition('A1>0')).toBe('=OR(A1>0)'));
  it('notCondition', () => expect(notCondition('A1>0')).toBe('=NOT(A1>0)'));
  it('ifErrorCondition', () => expect(ifErrorCondition('A1/B1', '0')).toBe('=IFERROR(A1/B1,0)'));
});
