import { Controller, Get, Post, Body, Query, UseGuards, ParseFloatPipe ,Param} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import {RolesGuard} from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { PointsOfInterestService } from '../services/points-of-interest.service';
import { CreatePointOfInterestDto } from '../dto/create-poi.dto';

@ApiTags('Points of Interest')
@Controller('locations/poi')
export class PointsOfInterestController {
  constructor(private readonly poisService: PointsOfInterestService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un point d\'intérêt (Admin)' })
  create(@Body() dto: CreatePointOfInterestDto) {
    return this.poisService.create(dto);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Points d\'intérêt à proximité' })
  @ApiQuery({ name: 'lat', description: 'Latitude' })
  @ApiQuery({ name: 'lng', description: 'Longitude' })
  @ApiQuery({ name: 'radius', description: 'Rayon en km', required: false })
  @ApiQuery({ name: 'category', description: 'Catégorie', required: false })
  findNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius') radius?: string,
    @Query('category') category?: string,
  ) {
    return this.poisService.findNearby(
      { latitude: lat, longitude: lng },
      radius ? parseInt(radius) : 10,
      category,
    );
  }

  @Get('popular')
  @ApiOperation({ summary: 'Points d\'intérêt populaires' })
  findPopular(
    @Query('country') country?: string,
    @Query('city') city?: string,
  ) {
    return this.poisService.findPopular(country, city);
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Points d\'intérêt par catégorie' })
  findByCategory(
    @Param('category') category: string,
    @Query('country') country?: string,
    @Query('city') city?: string,
  ) {
    return this.poisService.findByCategory(category, country, city);
  }
}
