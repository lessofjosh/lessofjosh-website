<?php
/**
 * Build script to regenerate public/assets/pdf/Less-of-Josh-Media-Kit.pdf
 * from src/data/site-config.json using Dompdf and templates/media-kit-pdf.php.
 *
 * Usage: php scripts/build-pdf.php
 */

$project_root = dirname( __DIR__ );
$config_path  = $project_root . '/src/data/site-config.json';
$output_path  = $project_root . '/public/assets/pdf/Less-of-Josh-Media-Kit.pdf';

$theme_dir = '/Users/joshuagreenway/Documents/lessofjosh-site/less-of-josh-theme';
if ( ! is_dir( $theme_dir . '/vendor' ) ) {
	fwrite( STDERR, "Dompdf vendor directory not found at {$theme_dir}/vendor; keeping existing cached PDF.\n" );
	exit( 0 );
}

require_once $theme_dir . '/vendor/autoload.php';

$config = json_decode( (string) file_get_contents( $config_path ), true );
if ( ! is_array( $config ) ) {
	fwrite( STDERR, "Invalid site-config.json\n" );
	exit( 1 );
}

define( 'ABSPATH', $theme_dir . '/' );
define( 'LOJ_THEME_VERSION', '2.0.3' );
define( 'LOJ_THEME_PATH', rtrim( $theme_dir, '/' ) . '/' );
define( 'LOJ_THEME_URL', 'https://lessofjosh.com/wp-content/themes/less-of-josh-theme/' );

if ( ! function_exists( 'esc_html' ) ) {
	function esc_html( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}
if ( ! function_exists( 'esc_attr' ) ) {
	function esc_attr( $text ) {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}
if ( ! function_exists( 'wp_date' ) ) {
	function wp_date( $format, $timestamp = null ) {
		return gmdate( $format, $timestamp ?? time() );
	}
}

$lost      = (float) ( $config['current_weight_loss'] ?? 232.6 );
$lost_str  = 0.0 === fmod( $lost, 1.0 ) ? number_format( $lost, 0 ) : number_format( $lost, 1 );
$platforms = $config['metrics_fallback']['platforms'] ?? array();

$compact = static function ( $n ) {
	$n = (float) $n;
	if ( $n >= 1000000 ) {
		return rtrim( rtrim( number_format( $n / 1000000, 1 ), '0' ), '.' ) . 'M';
	}
	if ( $n >= 1000 ) {
		return rtrim( rtrim( number_format( $n / 1000, 1 ), '0' ), '.' ) . 'K';
	}
	return number_format( $n );
};

$socials = array(
	'tiktok'    => array( 'label' => 'TikTok', 'handle' => '@lessofjosh', 'url' => 'https://www.tiktok.com/@lessofjosh' ),
	'instagram' => array( 'label' => 'Instagram', 'handle' => '@lessofjoshwv', 'url' => 'https://www.instagram.com/lessofjoshwv/' ),
	'facebook'  => array( 'label' => 'Facebook', 'handle' => 'Less of Josh', 'url' => 'https://www.facebook.com/people/Less-of-Josh/61578309146625/' ),
	'youtube'   => array( 'label' => 'YouTube', 'handle' => '@LessofJosh', 'url' => 'https://www.youtube.com/@LessofJosh' ),
);

$formatted_platforms = array();
$total_followers     = 0;
$rates               = array();

foreach ( $socials as $key => $meta ) {
	$p = $platforms[ $key ] ?? array();
	$f = (int) ( $p['followers'] ?? 0 );
	$v = (int) ( $p['views'] ?? 0 );
	$r = (float) ( $p['engagement_rate'] ?? 0 );
	$total_followers += $f;
	$rates[]          = $r;
	$formatted_platforms[ $key ] = array(
		'name'               => $meta['label'],
		'handle'             => $meta['handle'],
		'url'                => $meta['url'],
		'followers'          => $f,
		'views'              => $v,
		'engagement_rate'    => $r,
		'followers_display'  => $compact( $f ),
		'views_display'      => $compact( $v ),
		'engagement_display' => number_format( $r, 2 ) . '%',
	);
}

$avg_rate = $rates ? array_sum( $rates ) / count( $rates ) : 0;

$data = array(
	'year'            => gmdate( 'Y' ),
	'person'          => array(
		'name'       => 'Josh Greenway',
		'legal_name' => 'Joshua Greenway',
		'brand'      => 'Less of Josh',
		'location'   => 'Lewisburg, West Virginia',
		'address'    => $config['mailing_address'] ?? '',
	),
	'weight'          => array(
		'start'       => 715,
		'start_label' => '715+',
		'lost'        => $lost,
		'lost_label'  => $lost_str,
		'goal'        => 500,
		'updated'     => '',
	),
	'platforms'       => $formatted_platforms,
	'totals'          => array(
		'followers'          => $total_followers,
		'followers_display'  => $compact( $total_followers ),
		'engagement'         => $avg_rate,
		'engagement_display' => number_format( $avg_rate, 1 ) . '%',
	),
	'metrics_updated' => gmdate( 'M. j, Y' ),
	'contacts'        => array(
		'brand' => $config['brand_email'] ?? 'colab@lessofus.com',
		'media' => $config['media_email'] ?? 'media@lessofjosh.com',
	),
	'socials'         => $socials,
	'photos'          => array(
		'before'  => array(
			'file'   => LOJ_THEME_PATH . 'assets/pdf-images/josh-before-framed.jpg',
			'width'  => 693,
			'height' => 912,
		),
		'current' => array(
			'file'   => LOJ_THEME_PATH . 'assets/pdf-images/josh-current-framed.jpg',
			'width'  => 693,
			'height' => 912,
			'zoom'   => 100,
			'custom' => false,
		),
	),
);

require_once LOJ_THEME_PATH . 'includes/class-loj-data.php';
$ref  = new ReflectionClass( 'LOJ_Theme_Data' );
$meth = $ref->getMethod( 'copy' );
$meth->setAccessible( true );
$data['copy'] = $meth->invoke( null, $data );

ob_start();
include LOJ_THEME_PATH . 'templates/media-kit-pdf.php';
$html = (string) ob_get_clean();

$font_cache = sys_get_temp_dir() . '/loj-dompdf-fonts';
if ( ! is_dir( $font_cache ) ) {
	mkdir( $font_cache, 0755, true );
}

$options = new \Dompdf\Options();
$options->set( 'isRemoteEnabled', false );
$options->set( 'isPhpEnabled', false );
$options->set( 'isJavascriptEnabled', false );
$options->set( 'isHtml5ParserEnabled', true );
$options->set( 'isFontSubsettingEnabled', true );
$options->set( 'defaultFont', 'Manrope' );
$options->set( 'defaultPaperSize', 'letter' );
$options->set( 'dpi', 144 );
$options->set( 'fontDir', $font_cache );
$options->set( 'fontCache', $font_cache );
$options->set( 'tempDir', sys_get_temp_dir() );
$options->set( 'chroot', array( LOJ_THEME_PATH, $project_root ) );

$dompdf = new \Dompdf\Dompdf( $options );
$dompdf->loadHtml( $html, 'UTF-8' );
$dompdf->setPaper( 'letter', 'portrait' );
$dompdf->addInfo( 'Title', 'Josh Greenway (Less of Josh) Media Kit ' . $data['year'] );
$dompdf->addInfo( 'Author', 'Josh Greenway / 35/63 Media' );
$dompdf->addInfo( 'Subject', 'Creator media kit: audience, content, partnerships, and contact' );
$dompdf->addInfo( 'Creator', 'lessofjosh.com' );
$dompdf->render();

file_put_contents( $output_path, $dompdf->output() );
echo "Generated {$output_path} (" . filesize( $output_path ) . " bytes)\n";
