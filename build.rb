#!/usr/bin/env ruby

require 'net/http'
require 'uri'
require 'optparse'
require 'tmpdir'
require 'socket'
require 'logger'
require 'thread'
require 'erb'

DIR = File.absolute_path(File.dirname(__FILE__))

class HTTPServer
	MIME_TYPES = {
		'html htm' => 'text/html',
		'txt md rb' => 'text/plain',
		'css' => 'text/css',
		'js' => 'application/javascript',
		'xml' => 'application/xml',
		'json' => 'application/json',
		'jpeg jpg' => 'image/jpeg',
		'gif' => 'image/gif',
		'bmp' => 'image/bmp'
	}
	DIRECTORY_TEMPLATE = ERB.new <<-EOF
		<!DOCTYPE html>
		<html>
			<head>
				<title><%= dir %></title>
			</head>
			<style type='text/css'>
				body {
					font-family: "Proxima Nova Regular","Helvetica Neue",Arial,Helvetica,sans-serif;
					font-weight: 400;
					font-style: normal;
					color: #333;
				}
			</style>
			<body>
				<h1><%= dir %></h1>

				<table>
					<tbody>
						<% files.each do |f| %>
							<tr>
								<td>
									<% if f[:type] == :directory %>
										<img src='http://cdn1.iconfinder.com/data/icons/fugue/icon_shadowless/folder-horizontal-open.png'>
									<% else %>
										<img src='http://cdn1.iconfinder.com/data/icons/fugue/icon/document-list.png'>
									<% end %>
								</td>
								<td><a href='<%= f[:url] %>'><%= f[:title] %></a></td>
							</tr>
						<% end %>
					</tbody>
				</table>
			</body>
		</html>
	EOF

	class Request
		attr_accessor :body, :method, :path, :headers, :version, :query

		METHODS = [:get, :post, :put, :delete, :head]

		def initialize(headers)
			request_line = headers.shift.strip.split(/\s+/)

			@method = request_line[0].downcase.to_sym
			@version = request_line[2]

			path = URI.parse(request_line[1])

			@path = path.path
			@query = Hash[URI.decode_www_form(path.query || '').map { |p| [p.first.to_sym, p.last] }]

			@headers = {}

			headers.each do |line|
				line = line.split(/\s*:\s*/).map { |p| p.strip }
				@headers[line.first] = line.last.split('-').map { |p| p.downcase }.join('_').to_sym
			end
		end

		def status_line
			"#{method.to_s.upcase} #{path} #{version}"
		end

		def body?
			(method == :post or method == :put) and 
				(headers[:content_length] and headers[:content_length] > 0)
		end
	end
	class Response
		attr_accessor :body, :code, :version, :headers

		SERVER = 'rss'
		VERSION = 'HTTP/1.1'
		CODES = {
			200 => 'OK',
			201 => 'Created',
			202 => 'Accepted',
			301 => 'Moved Permanently',
			304 => 'Not Modified',
			307 => 'Temporay Redirect',
			400 => 'Bad Request',
			403 => 'Forbidden',
			404 => 'Not Found',
			408 => 'Request Timeout',
			413 => 'Request Entity Too Large',
			500 => 'Internal Server Error'
		}

		class << self
			def error(err)
				code = err.is_a?(ResponseError) ? err.code : 500

				Response.new(code, err.message)
			end
		end

		def initialize(code = 200, body = '')
			@code = code
			@version = VERSION
			@body = body

			@headers = {
				:server => SERVER,
				:content_type => 'text/plain',
				:connection => 'close'
			}
		end

		def status_line
			"#{@version} #{@code} #{CODES[@code]}"
		end

		def to_s
			if not CODES[@code]
				raise Error.new("Unsupported status code #{@code}")
			end

			@headers[:content_length] = body.bytesize
			@headers[:date] = Time.now.utc.strftime('%a, %d %b %Y %H:%M:%S GMT')

			result = [status_line]

			@headers.each_pair do |key, value|
				key = key.to_s.split('_').map { |p| p.capitalize }.join('-')

				result << "#{key}: #{value}"
			end

			"#{result.join("\r\n")}\r\n\r\n#{body}"
		end
	end

	class Error < StandardError; end
	class ResponseError < Error
		attr_reader :code

		class << self
			Response::CODES.each_pair do |code, message|
				define_method(message.split(' ').map { |p| p.downcase }.join('_').to_sym) do |msg = message|
					msg = msg.is_a?(Exception) ? msg.message : msg

					self.new(msg, code)
				end
			end
		end

		def initialize(msg = nil, code = 500)
			super(msg);

			@code = code
		end

		def to_response
			Response.error(self)
		end
	end

	attr_reader :logger

	def initialize(hostname, port = nil)
		if not port
			port = hostname
			hostname = nil
		end

		@hostname = hostname || '127.0.0.1'
		@port = port
		@run = true
		@routes = {}

		@logger = Logger.new(STDOUT)
		@logger.formatter = proc { |severity, datetime, progname, msg|
			"[#{datetime}] #{severity} -- #{progname}: #{msg}\n"
		}
	end

	def close
		@run = false
		@server.close if @server
	end

	def listen
		# Start new thread, so that interrupt (ctrl-c) doesn't hang
		Thread.new {
			Signal.trap('INT') {
				logger.info('Shutting down...')
				close
			}

			@server = TCPServer.new(@hostname, @port)

			logger.info("Server started #{@hostname}:#{@port}")
			logger.info("Ctrl-c to shut down")

			while @run
				begin
					Thread.new(@server.accept) { |s| handle_request(s) }
				rescue Exception => err
					@server.close rescue nil
					@server = nil

					logger.error(err.message) if @run

					break
				end
			end
		}.join
	end

	[:get, :post, :put, :delete, :head].each do |method|
		define_method(method) do |path, &block|
			@routes[method] ||= {}
			@routes[method][path] = block
		end
	end

	def route(request)
		route = @routes[request.method]
		route &&= route[request.path]

		if route
			route.call(request)
		else
			file(request)
		end
	end

	def file(request)
		path = File.join(DIR, request.path)

		if not File.exists?(path)
			raise ResponseError.not_found
		elsif File.directory?(path)
			return directory(request)
		end

		begin
			File.open(path, 'r') do |f|
				response = Response.new(200, f.read)
				response.headers[:content_type] = mime_type(path)

				response
			end
		rescue IOError, SystemCallError => err
			raise ResponseError.internal_server_error(err)
		end
	end

	def directory(request)
		dir = File.join(DIR, request.path)
		files = Dir.glob(File.join(dir, '*')).map { |f|
			is_dir = File.directory?(f)

			{
				:title => f.gsub(dir, '').gsub(/^\/*/, '') + (is_dir ? '/' : ''),
				:url => f.gsub(DIR, '').gsub(/^\/*/, '/'),
				:type => is_dir ? :directory : :file
			}
		}.sort { |x, y|
			if x[:type] === y[:type]
				x[:title].downcase <=> y[:title].downcase
			elsif x[:type] == :directory
				-1
			else
				1
			end
		}

		template = DIRECTORY_TEMPLATE.result(proc {}.binding)

		response = Response.new(200, template)
		response.headers[:content_type] = 'text/html; charset=utf-8'

		response
	end

	private

	def handle_request(socket)
		response = nil

		session = session_id
		port, ip = Socket.unpack_sockaddr_in(socket.getpeername)
		logger.info("(#{session}) Connection established #{ip}")

		begin
			headers = []

			while true
				line = socket.gets("\r\n")

				if not line
					raise ResponseError.request_timeout
				end

				line = line.strip

				if line.empty?
					break
				end

				headers << line
			end

			request = Request.new(headers)

			logger.info("(#{session}) " + request.status_line)

			if request.body?
				request.body = socket.recv(request.headers[:content_length])
			end

			response = file(request)
		rescue Error => err
			response = Response.error(err)
		rescue Exception => err
			response = Response.error(err)
			raise err
		ensure
			logger.info("(#{session}) " + response.status_line)

			socket.write(response.to_s) rescue nil
			socket.close rescue nil
		end
	end

	def mime_type(path)
		ext = File.extname(path).gsub(/^\./, '')
		type = MIME_TYPES.find { |key, _| key.include?(ext) }

		type ||= ['application/octet-stream']

		type = type.last

		if type.start_with?('text')
			type += '; charset=utf-8'
		end

		type
	end

	def session_id
		@session_id ||= 0
		@session_id += 1
	end
end

options = {}

GOOGLE_CLOSURE_COMPILER = URI.parse('http://closure-compiler.appspot.com/compile')
OUT_PATH = 'jquery-observe.js'

OptionParser.new { |opts|
	opts.banner = 'Usage: build.rb [options]'

	opts.on('-m', '--minify', 'Minify souce using the Google Closure Compiler') do 
		options[:minify] = true
	end

	opts.on('-j', '--jshint', 'Run the source trough JSHint') do
		options[:jshint] = true
	end

	opts.on('-s', '--server [PORT]', 'Start server') do |port|
		port = port.to_i

		options[:server] = port.zero? ? 3000 : port
	end
}.parse!

def concat
	template = "// File -- %s\n%s"

	out = []

	Dir.glob(File.join(DIR, 'lib', '*')).push(File.join(DIR, 'index.js')).each do |path|
		path = File.absolute_path(path, DIR)

		File.open(path, 'r') do |f|
			out << template % [path.gsub(DIR, '/').gsub(/^\/*/, './'), f.read]
		end
	end

	out.join("\n")
end

def minify(src)
	Net::HTTP.start(GOOGLE_CLOSURE_COMPILER.host, GOOGLE_CLOSURE_COMPILER.port) do |http|
		request = Net::HTTP::Post.new(GOOGLE_CLOSURE_COMPILER.request_uri)
		request.set_form_data({
			:js_code => src,
			:compilation_level => 'SIMPLE_OPTIMIZATIONS',
			:output_format => 'text',
			:output_info => 'compiled_code'
		})

		response = http.request(request)

		response.value
		response.body
	end
end

def jshint(src)
	tmp = File.join(Dir.tmpdir, OUT_PATH)

	File.open(tmp, 'w') do |f|
		f.write(src);
	end

	puts %x(jshint #{args.join(' ')}) rescue nil

	src
end

def out(src)
	File.open(File.join(DIR, OUT_PATH), 'w') do |f|
		f.write(src)
	end

	src
end

def main(options)
	if options[:server]
		HTTPServer.new(options[:server]).listen
		return
	end

	src = concat

	src = jshint(src) if options[:jshint]
	src = minify(src) if options[:minify]

	out(src)
end

main(options)
