import { describe, it, expect } from 'vitest';
import {
  detectDocumentTypeFromMessage,
  isGenericTitle,
  formatActionSuccessMessage,
} from './chatUtils';

describe('chatUtils', () => {
  describe('detectDocumentTypeFromMessage', () => {
    it('should detect PDF requests', () => {
      expect(detectDocumentTypeFromMessage('create a pdf document')).toBe('pdf');
      expect(detectDocumentTypeFromMessage('make my resume as a pdf')).toBe('pdf');
      expect(detectDocumentTypeFromMessage('generate a pdf file')).toBe('pdf');
      expect(detectDocumentTypeFromMessage('pdf resume')).toBe('pdf');
    });

    it('should detect Excel requests', () => {
      expect(detectDocumentTypeFromMessage('create an excel spreadsheet')).toBe('xlsx');
      expect(detectDocumentTypeFromMessage('make me a budget spreadsheet')).toBe('xlsx');
      expect(detectDocumentTypeFromMessage('generate an xlsx file')).toBe('xlsx');
    });

    it('should detect PowerPoint requests', () => {
      expect(detectDocumentTypeFromMessage('create a powerpoint presentation')).toBe('pptx');
      expect(detectDocumentTypeFromMessage('make slides about marketing')).toBe('pptx');
      expect(detectDocumentTypeFromMessage('build a slide deck for the meeting')).toBe('pptx');
    });

    it('should detect Word requests', () => {
      expect(detectDocumentTypeFromMessage('create a word document')).toBe('docx');
      expect(detectDocumentTypeFromMessage('make an editable document')).toBe('docx');
      expect(detectDocumentTypeFromMessage('generate a docx file')).toBe('docx');
    });

    it('should return null for non-document requests', () => {
      expect(detectDocumentTypeFromMessage('hello how are you')).toBeNull();
      expect(detectDocumentTypeFromMessage('explain quantum physics')).toBeNull();
      expect(detectDocumentTypeFromMessage('write me a poem')).toBeNull();
    });

    it('should prioritize PDF when slides are requested as PDF', () => {
      expect(detectDocumentTypeFromMessage('create slides as a pdf')).toBe('pdf');
      expect(detectDocumentTypeFromMessage('presentation in pdf format')).toBe('pdf');
    });
  });

  describe('isGenericTitle', () => {
    it('should detect generic titles', () => {
      expect(isGenericTitle('New Chat')).toBe(true);
      expect(isGenericTitle('Hello')).toBe(true);
      expect(isGenericTitle('hi')).toBe(true);
      expect(isGenericTitle('hey')).toBe(true);
      expect(isGenericTitle('test')).toBe(true);
      expect(isGenericTitle('Untitled')).toBe(true);
      expect(isGenericTitle('chat')).toBe(true);
      expect(isGenericTitle('conversation')).toBe(true);
      expect(isGenericTitle('Initial Greeting')).toBe(true);
      expect(isGenericTitle('Quick Question')).toBe(true);
    });

    it('should return true for empty/undefined titles', () => {
      expect(isGenericTitle(undefined)).toBe(true);
      expect(isGenericTitle('')).toBe(true);
    });

    it('should detect meaningful titles', () => {
      expect(isGenericTitle('React Performance Optimization')).toBe(false);
      expect(isGenericTitle('Budget Analysis Q1 2026')).toBe(false);
      expect(isGenericTitle('Fix login button CSS')).toBe(false);
    });
  });

  describe('formatActionSuccessMessage', () => {
    it('should format Gmail actions', () => {
      expect(formatActionSuccessMessage('Gmail', 'SEND_EMAIL', {})).toContain('Email sent');
      expect(formatActionSuccessMessage('gmail', 'CREATE_DRAFT', {})).toContain('Draft saved');
      expect(formatActionSuccessMessage('Gmail', 'REPLY_TO_EMAIL', {})).toContain('Reply sent');
    });

    it('should format Twitter/X actions', () => {
      expect(formatActionSuccessMessage('Twitter', 'POST_TWEET', {})).toContain('Tweet posted');
      expect(formatActionSuccessMessage('twitter', 'RETWEET', {})).toContain('Retweeted');
      expect(formatActionSuccessMessage('x', 'LIKE_CONTENT', {})).toContain('Liked');
    });

    it('should format Slack actions', () => {
      expect(formatActionSuccessMessage('Slack', 'SEND_MESSAGE', {})).toContain(
        'Slack message sent'
      );
    });

    it('should format GitHub actions', () => {
      expect(formatActionSuccessMessage('GitHub', 'CREATE_ISSUE', {})).toContain('GitHub issue');
      expect(formatActionSuccessMessage('github', 'CREATE_PR', {})).toContain('Pull request');
    });

    it('should handle unknown platforms with clean fallback', () => {
      const result = formatActionSuccessMessage('CustomPlatform', 'DO_THING', {});
      expect(result).toContain('DO_THING');
      expect(result).toContain('CustomPlatform');
      expect(result).toContain('completed successfully');
    });
  });
});
