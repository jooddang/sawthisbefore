import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { IssuesService } from './issues.service';

@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get(':number/triage')
  async getTriage(@Param('number', ParseIntPipe) number: number) {
    return this.issuesService.getTriageSuggestion(number);
  }

  @Post(':number/apply')
  async apply(@Param('number', ParseIntPipe) number: number) {
    return this.issuesService.applySuggestion(number);
  }
}


