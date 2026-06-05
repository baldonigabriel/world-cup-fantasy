import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DraftStateResponseDto } from './dto/draft-state-response.dto';
import { PickDto } from './dto/pick.dto';
import { DraftService } from './draft.service';

@ApiTags('draft')
@Controller('leagues/:leagueId/draft')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DraftController {
  constructor(private readonly draftService: DraftService) {}

  @Post('start')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Start the draft (owner only, requires draw to be done)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'Only the owner can start' })
  @ApiResponse({ status: 409, description: 'Order not drawn / already started' })
  start(
    @Param('leagueId') leagueId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    return this.draftService.startDraft(leagueId, user.id);
  }

  @Post('pick')
  @ApiOperation({ summary: 'Draft a player (must be your turn)' })
  @ApiResponse({ status: 201, type: DraftStateResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Not your turn / player taken / quota full / country conflict',
  })
  pick(
    @Param('leagueId') leagueId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PickDto,
  ): Promise<DraftStateResponseDto> {
    return this.draftService.pick(leagueId, user.id, dto.playerId);
  }

  @Get()
  @ApiOperation({ summary: 'Get current draft state' })
  @ApiResponse({ status: 200, type: DraftStateResponseDto })
  getState(@Param('leagueId') leagueId: string): Promise<DraftStateResponseDto> {
    return this.draftService.getState(leagueId);
  }
}
